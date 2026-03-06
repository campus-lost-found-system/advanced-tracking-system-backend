const { auth, db } = require('../firebaseAdmin');

const verifyFirebaseToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Support dev bypass token
        if (process.env.NODE_ENV !== 'production' && authHeader === 'Bearer fake-admin-token') {
            req.user = { uid: 'admin-uid', email: 'admin@gmail.com', role: 'admin' };
            return next();
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            if (process.env.NODE_ENV !== 'production') {
                req.user = { uid: 'test-user-123', email: 'test@example.com', role: 'user' };
                return next();
            }
            return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decodedToken = await auth.verifyIdToken(token);

        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Verify Token Error:', error);
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
    }
};

const requireAdminRole = async (req, res, next) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ success: false, error: 'Unauthorized: No user found' });
        }

        // Support dev bypass token role
        if (process.env.NODE_ENV !== 'production' && req.user.role === 'admin' && req.user.uid === 'admin-uid') {
            return next();
        }

        const userDoc = await db.collection('users').doc(req.user.uid).get();

        if (!userDoc.exists) {
            return res.status(403).json({ success: false, error: 'Forbidden: User profile not found' });
        }

        const userData = userDoc.data();
        if (userData.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
        }

        req.user.role = 'admin'; // ensure it is explicitly set
        next();
    } catch (error) {
        console.error('Require Admin Role Error:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error during role verification' });
    }
};

module.exports = {
    verifyFirebaseToken,
    requireAdminRole
};
