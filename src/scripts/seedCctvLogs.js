const { db } = require('../firebaseAdmin');

/**
 * Seed the cctvLogs collection with 7 days of synthetic entries
 * across 4 zones, ~8-10 entries per zone per day.
 */
async function seedCctvLogs() {
    const zones = ['Library', 'Cafeteria', 'Main Gate', 'Lab Block'];

    const objectPool = [
        'black backpack', 'blue backpack', 'red backpack', 'grey backpack',
        'water bottle', 'metal water bottle', 'plastic bottle',
        'laptop', 'laptop charger', 'tablet',
        'wallet', 'leather wallet', 'card holder',
        'phone', 'smartphone', 'earbuds', 'headphones',
        'keys', 'keychain', 'car keys', 'room keys',
        'umbrella', 'sunglasses', 'notebook', 'textbook',
        'pencil case', 'lunch box', 'jacket', 'hoodie',
        'ID card', 'USB drive', 'mouse', 'calculator'
    ];

    // Location-specific extras to add variety
    const zoneExtras = {
        'Library': ['textbook', 'notebook', 'reading glasses', 'highlighter'],
        'Cafeteria': ['lunch box', 'food container', 'thermos', 'tray'],
        'Main Gate': ['bicycle helmet', 'umbrella', 'parking pass', 'badge'],
        'Lab Block': ['lab coat', 'safety goggles', 'USB drive', 'calculator']
    };

    const pick = (arr, count) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    };

    const batch = db.batch();
    let count = 0;

    const now = new Date();

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        for (const zone of zones) {
            const entriesPerDay = 8 + Math.floor(Math.random() * 3); // 8–10

            for (let e = 0; e < entriesPerDay; e++) {
                const date = new Date(now);
                date.setDate(date.getDate() - dayOffset);

                // Random hour between 8am and 8pm
                const hour = 8 + Math.floor(Math.random() * 12);
                const minute = Math.floor(Math.random() * 60);
                date.setHours(hour, minute, 0, 0);

                const pool = [...objectPool, ...(zoneExtras[zone] || [])];
                const numObjects = 1 + Math.floor(Math.random() * 4); // 1–4 objects
                const objects = pick(pool, numObjects);

                const ref = db.collection('cctvLogs').doc();
                batch.set(ref, {
                    zone,
                    timestamp: date,
                    objects
                });
                count++;
            }
        }
    }

    await batch.commit();
    return { seeded: count, message: `Seeded ${count} CCTV log entries across ${zones.length} zones for 7 days` };
}

module.exports = { seedCctvLogs };
