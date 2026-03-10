const http = require('http');

http.get('http://localhost:5000/api/items', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log("Status:", parsed.success);
            console.log("Total items:", parsed.data.length);
            console.log("First 3 items:");
            parsed.data.slice(0, 3).forEach(item => {
                console.log(`- ${item.id} | ${item.title} | ${item.imageUrl || 'NO_IMAGE'}`);
            });
        } catch (e) { console.error("Parse err", e, data.slice(0, 200)) }
    });
});
