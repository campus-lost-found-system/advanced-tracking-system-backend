const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Ensure we don't initialize multiple times
if (!admin.apps.length) {
    const commonConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
    };

    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
        // Strategy 1: explicit env vars (private key in .env)
        console.log("Initializing Firebase with Environment Variables...");
        admin.initializeApp({
            ...commonConfig,
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
        });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Strategy 2: service account JSON file path
        const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const absolutePath = path.isAbsolute(saPath) ? saPath : path.resolve(process.cwd(), saPath);
        console.log(`Initializing Firebase with service account: ${absolutePath}`);
        const serviceAccount = require(absolutePath);
        admin.initializeApp({
            ...commonConfig,
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        // Strategy 3: Application Default Credentials
        console.log('Initializing Firebase with default application credentials...');
        admin.initializeApp(commonConfig);
    }
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = { admin, db, auth, storage };
