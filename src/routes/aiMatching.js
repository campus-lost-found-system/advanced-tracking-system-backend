const express = require('express');
const router = express.Router();
const matchingService = require('../services/matchingService');
const cctvService = require('../services/cctvService');
const { db } = require('../firebaseAdmin');
const { verifyFirebaseToken, requireAdminRole } = require('../middlewares/authMiddleware');

const VALID_COLLECTIONS = ['lostItems', 'foundItems'];

const sendError = (res, error) => {
    if (error.isParseError) {
        console.error('AI Parse error:', error.raw);
        return res.status(500).json({ success: false, error: 'AI response parse failed', raw: error.raw });
    }
    console.error('Route error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
};

// POST /api/ai/extract-features/:itemId/:collection
router.post('/ai/extract-features/:itemId/:collection', verifyFirebaseToken, async (req, res) => {
    try {
        const { itemId, collection } = req.params;
        if (!itemId) return res.status(400).json({ success: false, error: 'itemId is required' });
        if (!VALID_COLLECTIONS.includes(collection)) {
            return res.status(400).json({ success: false, error: 'collection must be "lostItems" or "foundItems"' });
        }

        const features = await matchingService.extractFeatures(itemId, collection);
        return res.json({ success: true, data: features });
    } catch (error) {
        sendError(res, error);
    }
});

// POST /api/ai/compare-and-suggest/:itemId/:collection
router.post('/ai/compare-and-suggest/:itemId/:collection', verifyFirebaseToken, async (req, res) => {
    try {
        const { itemId, collection } = req.params;
        if (!itemId) return res.status(400).json({ success: false, error: 'itemId is required' });
        if (!VALID_COLLECTIONS.includes(collection)) {
            return res.status(400).json({ success: false, error: 'collection must be "lostItems" or "foundItems"' });
        }

        const suggestions = await matchingService.compareAndSuggest(itemId, collection);
        return res.json({ success: true, data: suggestions });
    } catch (error) {
        sendError(res, error);
    }
});

// POST /api/ai/verify-claim/:claimId — unified verification (AI + CCTV)
router.post('/ai/verify-claim/:claimId', verifyFirebaseToken, requireAdminRole, async (req, res) => {
    try {
        const { claimId } = req.params;
        if (!claimId) return res.status(400).json({ success: false, error: 'claimId is required' });

        // Read the claim
        const claimDoc = await db.collection('claims').doc(claimId).get();
        if (!claimDoc.exists) return res.status(404).json({ success: false, error: 'Claim not found' });
        const claim = claimDoc.data();

        if (!claim.lostItemId || !claim.itemId) {
            return res.status(400).json({ success: false, error: 'Claim is missing lostItemId or itemId' });
        }

        // 1. AI Image Comparison
        let aiMatch = null;
        try {
            aiMatch = await matchingService.compareTwo(claim.lostItemId, claim.itemId);
        } catch (err) {
            console.error('AI comparison failed:', err.message);
            aiMatch = { error: err.message };
        }

        // 2. CCTV Verification
        let cctvResult = null;
        try {
            cctvResult = await cctvService.verifyClaim(claimId);
        } catch (err) {
            console.error('CCTV verification failed:', err.message);
            cctvResult = { error: err.message };
        }

        const result = { aiMatch, cctvVerification: cctvResult };
        return res.json({ success: true, data: result });
    } catch (error) {
        sendError(res, error);
    }
});

module.exports = router;
