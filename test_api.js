const http = require('http');

http.get('http://localhost:5000/api/items', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log("Items output:", data));
});
