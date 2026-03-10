const { success, error } = require('../utils/response');
const firebaseService = require('../services/firebase.service');

const getProfile = async (req, res) => {
    try {
        // req.user is populated by auth middleware
        const uid = req.user.uid;

        // Mock response for dev/testing environment
        if (uid === 'admin-uid') {
            return success(res, {
                uid: 'admin-uid',
                email: 'admin@gmail.com',
                displayName: 'System Admin',
                role: 'admin'
            });
        }

        if (uid === 'test-user-123') {
            return success(res, {
                uid: 'test-user-123',
                email: 'test@example.com',
                displayName: 'Test User',
                role: 'user'
            });
        }

        let userData;
        try {
            const userRecord = await firebaseService.getUser(uid);
            userData = userRecord.toJSON ? userRecord.toJSON() : { ...userRecord };
        } catch (apiError) {
            console.warn(`Firebase API restricted [UID: ${uid}]. Using token fallback. Error: ${apiError.message}`);

            // FALLBACK: Construct profile from token data (req.user)
            // This allows the app to work even if the service account lacks "Firebase Auth Admin" permissions
            userData = {
                uid: req.user.uid,
                email: req.user.email || 'user@example.com',
                displayName: req.user.name || req.user.email?.split('@')[0] || 'User',
                photoURL: req.user.picture || null,
                role: req.user.role || 'user'
            };
        }

        // Hardcode admin role for specific account
        if (userData.email === 'admin@gmail.com') {
            userData.role = 'admin';
        } else {
            userData.role = userData.role || 'user';
        }

        return success(res, userData);
    } catch (err) {
        console.error(`Get Profile Fatal Error [UID: ${req.user?.uid}]:`, err.message);
        return error(res, 'Failed to resolve user profile', 500, err.message);
    }
};

const updateProfile = async (req, res) => {
    try {
        const uid = req.user.uid;
        // Mock handling for fake admin
        if (uid === 'admin-uid') {
            return success(res, req.body, 'Profile updated');
        }

        const { db } = require('../config/firebase');
        const userRef = db.collection('users').doc(uid);
        
        await userRef.set({
            ...req.body,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return success(res, req.body, 'Profile updated');
    } catch (err) {
        return error(res, 'Failed to update profile', 500, err.message);
    }
};

module.exports = {
    getProfile,
    updateProfile
};
