const { admin, db } = require('./src/config/firebase');

async function testFetch() {
    try {
        const items = await db.collection('items').orderBy('createdAt', 'desc').limit(2).get();
        items.forEach(doc => {
            console.log("ID:", doc.id);
            console.log("Title:", doc.data().title);
            console.log("ImageUrl:", doc.data().imageUrl);
        });
    } catch (err) {
        console.error("Fetch failed:", err);
    } finally {
        process.exit();
    }
}

testFetch();
