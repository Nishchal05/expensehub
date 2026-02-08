const http = require('http');

const data = JSON.stringify({
    currentCategories: ['Food & Dining', 'Entertainment']
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/suggest-categories',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    let body = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', d => {
        body += d;
    });

    res.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            console.log('Response Body:', JSON.stringify(parsed, null, 2));

            const suggestions = parsed.suggestions;
            if (!suggestions || suggestions.length > 3) {
                console.error('FAIL: Should return only 3 suggestions');
                process.exit(1);
            }

            if (suggestions.includes('Food & Dining') || suggestions.includes('Entertainment')) {
                console.error('FAIL: Should exclude provided categories');
                process.exit(1);
            }

            console.log('SUCCESS: Endpoint behaves as expected');
        } catch (e) {
            console.error('Error parsing response:', e);
        }
    });
});

req.on('error', error => {
    console.error('Request Error:', error);
});

req.write(data);
req.end();
