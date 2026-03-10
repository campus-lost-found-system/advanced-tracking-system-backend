const { db } = require('../firebaseAdmin');
const groqVision = require('./groqVisionService');
const fetch = require('node-fetch');

class MatchingService {

    /**
     * Returns a base64 data-URI for an image — handles both:
     *   - data URIs already stored in Firestore ("data:image/jpeg;base64,...")
     *   - regular http/https URLs that need to be downloaded
     */
    async _getBase64Image(imageUrl) {
        const url = (imageUrl || '').trim();
        if (url.startsWith('data:image')) {
            // Already a base64 data URI — return as-is
            return url;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            throw new Error(`Invalid image URL (must be http/https or data URI): "${url.substring(0, 80)}"`);
        }
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdvancedTrackingSystem/1.0)' }
        });
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        const buffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    /**
     * Extract visual features from an item's image using Groq vision.
     *
     * @param {string} itemId   – Firestore document ID
     * @param {string} collection – "lostItems" or "foundItems"
     * @returns {Object} extracted features
     */
    async extractFeatures(itemId, collectionParam) {
        const itemDoc = await db.collection('items').doc(itemId).get();
        if (!itemDoc.exists) throw new Error(`Item not found in items collection`);

        const item = itemDoc.data();
        if (!item.imageUrl) throw new Error('Item does not have an image URL');

        console.log(`[extractFeatures] itemId=${itemId} collection=${collectionParam}`);
        const base64Image = await this._getBase64Image(item.imageUrl);

        const systemPrompt =
            'You are a visual feature extractor. Analyze this item image and return ONLY a JSON object with these fields: ' +
            '{ "category": string, "colors": string[], "shape": string, "size_estimate": string, ' +
            '"distinctive_features": string[], "texture": string }. ' +
            'No explanation, no markdown, raw JSON only.';

        const features = await groqVision.analyzeImage(base64Image, systemPrompt);

        // Write features back into the same document
        await db.collection('items').doc(itemId).update({ features });

        return features;
    }

    /**
     * Compare an item against all items in the OPPOSITE collection that already
     * have features extracted, apply metadata boosts, and return top-10 suggestions.
     *
     * @param {string} itemId     – Firestore document ID
     * @param {string} collection – "lostItems" or "foundItems"
     * @returns {Array|null} top-10 suggestions or null
     */
    async compareAndSuggest(itemId, collectionParam) {
        // 1. Read source item (must already have features)
        const sourceDoc = await db.collection('items').doc(itemId).get();
        if (!sourceDoc.exists) throw new Error(`Item not found in items collection`);
        const sourceItem = sourceDoc.data();
        if (!sourceItem.features) throw new Error('Features not extracted yet — call extractFeatures first');

        // 2. Determine opposite collection
        const oppositeType = sourceItem.type === 'lost' ? 'found' : 'lost';

        // 3. Fetch all candidates that have features
        const candidatesSnapshot = await db.collection('items')
            .where('type', '==', oppositeType)
            .get();
        const candidates = [];
        candidatesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.features) {
                candidates.push({ id: doc.id, ...data });
            }
        });

        if (candidates.length === 0) return null;

        // 4. Score each candidate
        const systemPrompt =
            'You are an item similarity scorer. Given two item feature descriptions as JSON, ' +
            'return ONLY a JSON object: { "similarity_score": number (0.0–1.0), ' +
            '"matching_attributes": string[], "mismatched_attributes": string[] }. ' +
            'No explanation, raw JSON only.';

        const scoredResults = [];

        for (const candidate of candidates) {
            try {
                const prompt =
                    `Item A features: ${JSON.stringify(sourceItem.features)}\n` +
                    `Item B features: ${JSON.stringify(candidate.features)}`;

                const result = await groqVision.analyzeText(systemPrompt, prompt);
                let score = result.similarity_score || 0;

                // ---- Metadata boosts ----
                // Same zone → +0.10
                if (sourceItem.zone && candidate.zone &&
                    sourceItem.zone.toLowerCase() === candidate.zone.toLowerCase()) {
                    score += 0.10;
                }

                // Within 3 days → +0.10
                if (sourceItem.reportedDate && candidate.reportedDate) {
                    const d1 = new Date(sourceItem.reportedDate).getTime();
                    const d2 = new Date(candidate.reportedDate).getTime();
                    const diffDays = Math.abs((d1 - d2) / (1000 * 3600 * 24));
                    if (diffDays <= 3) {
                        score += 0.10;
                    }
                }

                // Same category → +0.15, different category → -0.20
                const srcCat = (sourceItem.features.category || '').toLowerCase();
                const candCat = (candidate.features.category || '').toLowerCase();
                if (srcCat && candCat) {
                    if (srcCat === candCat) {
                        score += 0.15;
                    } else {
                        score -= 0.20;
                    }
                }

                // Clamp 0–1
                score = Math.max(0, Math.min(1, score));

                // Discard below threshold
                if (score < 0.30) continue;

                scoredResults.push({
                    itemId: candidate.id,
                    title: candidate.title || null,
                    description: candidate.description || null,
                    zone: candidate.zone || null,
                    reportedDate: candidate.reportedDate || null,
                    imageUrl: candidate.imageUrl || null,
                    features: candidate.features,
                    score: parseFloat(score.toFixed(3)),
                    matchingAttributes: result.matching_attributes || [],
                    mismatchedAttributes: result.mismatched_attributes || []
                });
            } catch (err) {
                // If one comparison fails, skip and continue
                console.error(`Comparison failed for candidate ${candidate.id}:`, err.message);
            }
        }
        if (scoredResults.length === 0) return null;

        // 5. Sort descending, take top 10
        scoredResults.sort((a, b) => b.score - a.score);
        const top10 = scoredResults.slice(0, 10);

        // 6. Strip sensitive fields from each result
        for (const item of top10) {
            delete item.ownerUid;
            delete item.ownerEmail;
            delete item.ownerPhone;
        }

        return top10;

    }

    /**
     * Compare a specific lost item against a specific found item.
     * Extracts features from both if not already extracted, then uses Groq AI
     * to produce a similarity score.
     *
     * @param {string} lostItemId  – the claimant's lost item
     * @param {string} foundItemId – the found item being claimed
     * @returns {Object} { similarity_score, matching_attributes, mismatched_attributes, lostFeatures, foundFeatures }
     */
    async compareTwo(lostItemId, foundItemId) {
        // 1. Read both items
        const lostDoc = await db.collection('items').doc(lostItemId).get();
        if (!lostDoc.exists) throw new Error('Lost item not found');
        const foundDoc = await db.collection('items').doc(foundItemId).get();
        if (!foundDoc.exists) throw new Error('Found item not found');

        const lostItem = lostDoc.data();
        const foundItem = foundDoc.data();

        // 2. Extract features if missing
        if (!lostItem.features && lostItem.imageUrl) {
            const base64 = await this._getBase64Image(lostItem.imageUrl);
            const extractPrompt =
                'You are a visual feature extractor. Analyze this item image and return ONLY a JSON object with these fields: ' +
                '{ "category": string, "colors": string[], "shape": string, "size_estimate": string, ' +
                '"distinctive_features": string[], "texture": string }. ' +
                'No explanation, no markdown, raw JSON only.';
            lostItem.features = await groqVision.analyzeImage(base64, extractPrompt);
            await db.collection('items').doc(lostItemId).update({ features: lostItem.features });
        }

        if (!foundItem.features && foundItem.imageUrl) {
            const base64 = await this._getBase64Image(foundItem.imageUrl);
            const extractPrompt =
                'You are a visual feature extractor. Analyze this item image and return ONLY a JSON object with these fields: ' +
                '{ "category": string, "colors": string[], "shape": string, "size_estimate": string, ' +
                '"distinctive_features": string[], "texture": string }. ' +
                'No explanation, no markdown, raw JSON only.';
            foundItem.features = await groqVision.analyzeImage(base64, extractPrompt);
            await db.collection('items').doc(foundItemId).update({ features: foundItem.features });
        }

        if (!lostItem.features || !foundItem.features) {
            throw new Error('Could not extract features from one or both items (no image?)');
        }

        // 3. Compare using Groq AI
        const systemPrompt =
            'You are an item similarity scorer. Given two item feature descriptions as JSON, ' +
            'return ONLY a JSON object: { "similarity_score": number (0.0–1.0), ' +
            '"matching_attributes": string[], "mismatched_attributes": string[] }. ' +
            'No explanation, raw JSON only.';

        const prompt =
            `Lost item features: ${JSON.stringify(lostItem.features)}\n` +
            `Found item features: ${JSON.stringify(foundItem.features)}`;

        const result = await groqVision.analyzeText(systemPrompt, prompt);

        let score = result.similarity_score || 0;

        // Metadata boosts
        const lostZone = (lostItem.zone || lostItem.location || '').toLowerCase();
        const foundZone = (foundItem.zone || foundItem.location || '').toLowerCase();
        if (lostZone && foundZone && lostZone === foundZone) {
            score += 0.10;
        }

        const srcCat = (lostItem.features.category || '').toLowerCase();
        const candCat = (foundItem.features.category || '').toLowerCase();
        if (srcCat && candCat) {
            if (srcCat === candCat) score += 0.15;
            else score -= 0.20;
        }

        score = Math.max(0, Math.min(1, score));

        return {
            similarity_score: parseFloat(score.toFixed(3)),
            matching_attributes: result.matching_attributes || [],
            mismatched_attributes: result.mismatched_attributes || [],
            lostFeatures: lostItem.features,
            foundFeatures: foundItem.features
        };
    }
}

module.exports = new MatchingService();
