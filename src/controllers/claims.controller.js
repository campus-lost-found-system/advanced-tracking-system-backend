const claimsService = require('../services/claims.service');
const auditService = require('../services/audit.service');
const communicationService = require('../services/communication.service');
const analyticsService = require('../services/analytics.service');
const { success, error } = require('../utils/response');

// Helper to check admin status
const isAdmin = (user) => {
    // Check for standard Firebase admin claim or custom role field
    return user.admin === true || user.role === 'admin';
};

const createClaim = async (req, res) => {
    try {
        const { itemId, lostItemId } = req.body;
        const uid = req.user.uid;

        if (!itemId) {
            return error(res, 'ItemId is required', 400);
        }
        if (!lostItemId) {
            return error(res, 'lostItemId is required — select your lost item', 400);
        }

        const result = await claimsService.createClaim(itemId, uid, lostItemId);
        return success(res, result, 'Claim submitted successfully', 201);
    } catch (err) {
        if (err.message.includes('Duplicate claim')) {
            return error(res, err.message, 400);
        }
        return error(res, 'Failed to create claim', 500, err.message);
    }
};

const getMyClaims = async (req, res) => {
    try {
        const uid = req.user.uid;
        const claims = await claimsService.getMyClaims(uid);
        return success(res, claims);
    } catch (err) {
        return error(res, 'Failed to fetch your claims', 500, err.message);
    }
};

const getPendingClaims = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return error(res, 'Forbidden: Admin access only', 403);
        }

        const claims = await claimsService.getPendingClaims();
        return success(res, claims);
    } catch (err) {
        return error(res, 'Failed to fetch pending claims', 500, err.message);
    }
};

const approveClaim = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return error(res, 'Forbidden: Admin access only', 403);
        }

        const { id } = req.params;
        const { remarks } = req.body;
        const result = await claimsService.approveClaim(id);

        // Log action
        await auditService.logAction(req.user.uid, 'APPROVE', id, { remarks });

        return success(res, result, 'Claim approved');
    } catch (err) {
        if (err.message === 'Claim not found') {
            return error(res, err.message, 404);
        }
        if (err.message === 'Claim is not pending') {
            return error(res, err.message, 400);
        }
        return error(res, 'Failed to approve claim', 500, err.message);
    }
};

const rejectClaim = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return error(res, 'Forbidden: Admin access only', 403);
        }

        const { id } = req.params;
        const { remarks } = req.body;
        const result = await claimsService.rejectClaim(id);

        // Log action
        await auditService.logAction(req.user.uid, 'REJECT', id, { remarks });

        return success(res, result, 'Claim rejected');
    } catch (err) {
        return error(res, 'Failed to reject claim', 500, err.message);
    }
};

const addNote = async (req, res) => {
    try {
        if (!isAdmin(req.user)) return error(res, 'Forbidden', 403);
        const { id } = req.params;
        const { text } = req.body;
        const note = await claimsService.addAdminNote(id, req.user.uid, text);
        return success(res, note, 'Note added');
    } catch (err) {
        return error(res, 'Failed to add note', 500, err.message);
    }
};

const getEvidence = async (req, res) => {
    try {
        if (!isAdmin(req.user)) return error(res, 'Forbidden', 403);
        const { id } = req.params;
        const evidence = await claimsService.getClaimEvidence(id);
        return success(res, evidence);
    } catch (err) {
        return error(res, 'Failed to get evidence', 500, err.message);
    }
};

const reopenClaim = async (req, res) => {
    try {
        if (!isAdmin(req.user)) return error(res, 'Forbidden', 403);
        const { id } = req.params;
        const result = await claimsService.reopenClaim(id);
        await auditService.logAction(req.user.uid, 'REOPEN', id);
        return success(res, result, 'Claim reopened');
    } catch (err) {
        return error(res, 'Failed to reopen claim', 500, err.message);
    }
};

const sendMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        // User or Admin can send
        const msg = await communicationService.sendMessage(id, req.user.uid, content);
        return success(res, msg, 'Message sent');
    } catch (err) {
        return error(res, 'Failed to send message', 500, err.message);
    }
};

const getMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await communicationService.getMessages(id);
        return success(res, messages);
    } catch (err) {
        return error(res, 'Failed to get messages', 500, err.message);
    }
};

const requestProof = async (req, res) => {
    try {
        if (!isAdmin(req.user)) return error(res, 'Forbidden', 403);
        const { id } = req.params;
        const result = await communicationService.requestProof(id, req.user.uid);
        return success(res, result, 'Proof requested');
    } catch (err) {
        return error(res, 'Failed to request proof', 500, err.message);
    }
};

const getAnalytics = async (req, res) => {
    try {
        if (!isAdmin(req.user)) return error(res, 'Forbidden', 403);
        const stats = await analyticsService.getClaimStats();
        return success(res, stats);
    } catch (err) {
        return error(res, 'Failed to get analytics', 500, err.message);
    }
};

module.exports = {
    createClaim,
    getMyClaims,
    getPendingClaims,
    approveClaim,
    rejectClaim,
    addNote,
    getEvidence,
    reopenClaim,
    sendMessage,
    getMessages,
    requestProof,
    getAnalytics
};
