const express = require('express');
const router = express.Router();
const cctvService = require('../services/cctvService');
const { seedCctvLogs } = require('../scripts/seedCctvLogs');
const { verifyFirebaseToken, requireAdminRole } = require('../middlewares/authMiddleware');
const { db } = require('../firebaseAdmin');

const sendError = (res, error) => {
    if (error.isParseError) {
        console.error('AI Parse error:', error.raw);
        return res.status(500).json({ success: false, error: 'AI response parse failed', raw: error.raw });
    }
    console.error('CCTV Route error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
};

// All CCTV routes require Auth + Admin
router.use(verifyFirebaseToken);
router.use(requireAdminRole);

// POST /api/cctv/seed-logs — run once to populate cctvLogs collection
router.post('/seed-logs', async (req, res) => {
    try {
        const result = await seedCctvLogs();
        return res.json({ success: true, data: result });
    } catch (error) {
        sendError(res, error);
    }
});

// POST /api/cctv/verify-claim/:claimId — run CCTV-based claim verification
router.post('/verify-claim/:claimId', async (req, res) => {
    try {
        const { claimId } = req.params;
        if (!claimId) return res.status(400).json({ success: false, error: 'claimId is required' });

        const verdict = await cctvService.verifyClaim(claimId);
        return res.json({ success: true, data: verdict });
    } catch (error) {
        sendError(res, error);
    }
});

// GET /api/cctv/verification-result/:claimId — read saved verdict
router.get('/verification-result/:claimId', async (req, res) => {
    try {
        const { claimId } = req.params;
        if (!claimId) return res.status(400).json({ success: false, error: 'claimId is required' });

        const doc = await db.collection('claims').doc(claimId).collection('cctvVerification').doc('summary').get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'No verification result found for this claim' });
        }

        return res.json({ success: true, data: doc.data() });
    } catch (error) {
        sendError(res, error);
    }
});

module.exports = router;
