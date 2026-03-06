const admin = require('firebase-admin');
const serviceAccount = require("C:\\Users\\Lenovo\\Downloads\\se-proj-d86c6-firebase-adminsdk-fbsvc-5b92c4e8c0.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const data = {
    // Your existing items
    'lostItems/lostItem001': {
        "title": "Black Backpack",
        "zone": "Library",
        "category": "bag",
        "reportedDate": "2024-01-15",
        "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Big_Black_Bag.jpg/320px-Big_Black_Bag.jpg",
        "ownerUid": "user123",
        "ownerEmail": "owner@test.com",
        "ownerPhone": "9999999999"
    },
    'foundItems/foundItem001': {
        "title": "Dark Bag Found Near Library",
        "zone": "Library",
        "category": "bag",
        "reportedDate": "2024-01-15",
        "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Big_Black_Bag.jpg/320px-Big_Black_Bag.jpg",
        "ownerUid": "finder456",
        "ownerEmail": "finder@test.com",
        "ownerPhone": "8888888888"
    },
    // The new claim document
    'claims/claim001': {
        "itemId": "lostItem001",
        "description": "I lost my black backpack near the library entrance",
        "zone": "Library",
        "timeOfLoss": "10:30",
        "dateOfLoss": "2024-01-15",
        "claimantImageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Big_Black_Bag.jpg/320px-Big_Black_Bag.jpg",
        "status": "pending"
    }
};

async function upload() {
    try {
        for (const [path, doc] of Object.entries(data)) {
            await db.doc(path).set(doc);
            console.log(`Successfully uploaded: ${path}`);
        }
        console.log("All data successfully synced to Firestore.");
    } catch (error) {
        console.error("Error uploading data:", error);
    }
}

upload();