const { admin } = require('./src/config/firebase');

async function listBuckets() {
    try {
        const storage = admin.storage();
        const [buckets] = await storage.bucket().storage.getBuckets();
        console.log("Bucket count:", buckets.length);
        buckets.forEach(b => console.log(b.name));
    } catch (err) {
        console.error("Failed to list buckets:", err);
    } finally {
        process.exit();
    }
}

listBuckets();
