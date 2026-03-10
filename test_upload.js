const { admin, db } = require('./src/config/firebase');
const itemService = require('./src/services/items.service');

async function testUpload() {
    try {
        console.log("Starting test upload...");
        // Get a dummy item
        const items = await db.collection('items').limit(1).get();
        if (items.empty) {
            console.log("No items found to test with");
            return;
        }

        const item = items.docs[0];
        console.log(`Using item ${item.id} owned by ${item.data().userId}`);

        const dummyBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAP...";

        console.log("Calling uploadImage...");
        const result = await itemService.uploadImage(item.id, item.data().userId, dummyBase64);
        console.log("Upload successful:", result);
    } catch (err) {
        console.error("Upload failed with error:", err);
    } finally {
        process.exit(0);
    }
}

testUpload();
