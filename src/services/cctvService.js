const { db } = require('../firebaseAdmin');
const groqVision = require('./groqVisionService');
const matchingService = require('./matchingService');
const fetch = require('node-fetch');

class CctvService {

    /**
     * Download an image URL and return it as a base64 data-URI string.
     */
    async _getBase64Image(imageUrl) {
        const url = (imageUrl || '').trim();
        if (url.startsWith('data:image')) {
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
     * Verify a claim using CCTV logs + optional visual comparison + Groq AI verdict.
     *
     * Steps:
     *  1. Query cctvLogs for matching zone & ±2-hour window
     *  2. If claimantImageUrl exists, run Epic 3 compareAndSuggest
     *  3. Combine everything into a Groq prompt for final verdict
     *  4. Save result & return
     *
     * @param {string} claimId
     * @returns {Object} { match, confidence, reasoning, verdict }
     */
    async verifyClaim(claimId) {
        // ── 1. Read claim ────────────────────────────────────────────────
        const claimDoc = await db.collection('claims').doc(claimId).get();
        if (!claimDoc.exists) throw new Error('Claim not found');
        const claim = claimDoc.data();

        const zone = claim.zone;
        const timeOfLoss = claim.timeOfLoss;   // e.g. "10:30am"
        const dateOfLoss = claim.dateOfLoss;   // e.g. "2024-01-15"

        if (!zone) throw new Error('Claim is missing zone');
        if (!dateOfLoss) throw new Error('Claim is missing dateOfLoss');

        // ── 2. Build timestamp window ────────────────────────────────────
        // Parse dateOfLoss + timeOfLoss into a Date, then ±2 hours
        let referenceDate;
        if (timeOfLoss) {
            referenceDate = this._parseDateTime(dateOfLoss, timeOfLoss);
        } else {
            referenceDate = new Date(dateOfLoss);
            referenceDate.setHours(12, 0, 0, 0); // default to noon if no time
        }

        const twoHoursMs = 2 * 60 * 60 * 1000;
        const windowStart = new Date(referenceDate.getTime() - twoHoursMs);
        const windowEnd = new Date(referenceDate.getTime() + twoHoursMs);

        // ── 3. Query CCTV logs ───────────────────────────────────────────
        const logsSnapshot = await db.collection('cctvLogs')
            .where('zone', '==', zone)
            .where('timestamp', '>=', windowStart)
            .where('timestamp', '<=', windowEnd)
            .get();

        let formattedLogEntries = 'No CCTV log entries found for this zone and time window.';

        if (!logsSnapshot.empty) {
            const entries = [];
            logsSnapshot.forEach(doc => {
                const data = doc.data();
                const ts = data.timestamp && data.timestamp.toDate
                    ? data.timestamp.toDate()
                    : new Date(data.timestamp);
                const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const objectsList = (data.objects || []).join(', ');
                entries.push(`${timeStr} - ${objectsList} seen near ${zone}`);
            });
            formattedLogEntries = entries.join('\n');
        }

        // ── 4. Visual comparison (if photo exists) ───────────────────────
        let visualMatchResult = 'No image provided';

        if (claim.claimantImageUrl && claim.itemId) {
            try {
                // Try to find the item in lostItems first, then foundItems
                let itemCollection = null;
                const lostDoc = await db.collection('lostItems').doc(claim.itemId).get();
                if (lostDoc.exists) {
                    itemCollection = 'lostItems';
                } else {
                    const foundDoc = await db.collection('foundItems').doc(claim.itemId).get();
                    if (foundDoc.exists) {
                        itemCollection = 'foundItems';
                    }
                }

                if (itemCollection) {
                    const suggestions = await matchingService.compareAndSuggest(claim.itemId, itemCollection);
                    if (suggestions && suggestions.length > 0) {
                        const top = suggestions[0];
                        visualMatchResult = `Visual comparison score: ${top.score}, matched attributes: ${top.matchingAttributes.join(', ')}`;
                    } else {
                        visualMatchResult = 'Visual comparison found no strong matches.';
                    }
                } else {
                    visualMatchResult = 'Referenced item not found in lostItems or foundItems.';
                }
            } catch (err) {
                console.error('Visual comparison failed:', err.message);
                visualMatchResult = `Visual comparison error: ${err.message}`;
            }
        }

        // ── 5. Build Groq prompt ─────────────────────────────────────────
        const userPrompt =
            `A user is claiming they lost an item. Here is the context:\n\n` +
            `User description: ${claim.description || 'No description provided'}\n` +
            `Location: ${zone}\n` +
            `Time: ${timeOfLoss || 'Not specified'}\n` +
            `Date: ${dateOfLoss}\n\n` +
            `CCTV log entries from that location and time:\n${formattedLogEntries}\n\n` +
            `Visual match result (if available):\n${visualMatchResult}\n\n` +
            `Based on all of this, how likely is it that this claim is legitimate?\n` +
            `Return ONLY JSON:\n` +
            `{\n` +
            `  "match": true or false,\n` +
            `  "confidence": 0.0 to 1.0,\n` +
            `  "reasoning": "string",\n` +
            `  "verdict": "likely_valid" or "possibly_valid" or "likely_invalid"\n` +
            `}`;

        const systemPrompt =
            'You are a claim verification AI. Analyze the provided context (CCTV logs, visual match, ' +
            'user description) and determine how likely a lost-item claim is legitimate. ' +
            'Return ONLY valid JSON with the fields: match (boolean), confidence (0.0-1.0), ' +
            'reasoning (string), verdict (likely_valid | possibly_valid | likely_invalid).';

        let verdict;

        if (claim.claimantImageUrl) {
            // Use image + text prompt
            const base64Image = await this._getBase64Image(claim.claimantImageUrl);
            verdict = await groqVision.analyzeImage(base64Image, systemPrompt, userPrompt);
        } else {
            // Text-only prompt
            verdict = await groqVision.analyzeText(systemPrompt, userPrompt);
        }

        // ── 6. Save and return ───────────────────────────────────────────
        const resultDoc = {
            ...verdict,
            claimId,
            verifiedAt: new Date()
        };

        await db.collection('claims').doc(claimId).collection('cctvVerification').doc('summary').set(resultDoc);

        return verdict;
    }

    /**
     * Parse a date string + time string like "2024-01-15" + "10:30am" into a Date.
     */
    _parseDateTime(dateStr, timeStr) {
        // Start with the date
        const date = new Date(dateStr);

        if (!timeStr) return date;

        // Parse time like "10:30am", "2:15PM", "14:30"
        const cleaned = timeStr.trim().toLowerCase();
        const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
        if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = match[3];

            if (period === 'pm' && hours !== 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;

            date.setHours(hours, minutes, 0, 0);
        }

        return date;
    }
}

module.exports = new CctvService();
