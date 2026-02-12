const http = require('http');

function postRequest(data) {
    return new Promise((resolve, reject) => {
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

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function verify() {
    try {
        console.log('--- Test 1: Initial list [Food & Dining] ---');
        const list1 = JSON.stringify(["Food & Dining"]);
        const res1 = await postRequest(list1);
        console.log('Response 1:', JSON.stringify(res1, null, 2));

        if (!res1.suggestions || res1.suggestions.includes("Food & Dining")) {
            console.error('FAILED: "Food & Dining" should be excluded.');
        }

        // Simulating user accepting the first suggestion
        const nextInput = ["Food & Dining", ...res1.suggestions];
        console.log('\n--- Test 2: List [Food & Dining, ' + res1.suggestions.join(', ') + '] ---');

        const list2 = JSON.stringify(nextInput);
        const res2 = await postRequest(list2);
        console.log('Response 2:', JSON.stringify(res2, null, 2));

        // Check for overlap
        const overlap = res2.suggestions.filter(s => nextInput.includes(s));
        if (overlap.length > 0) {
            console.error('FAILED: Suggestions should not include previous items:', overlap);
        } else {
            console.log('SUCCESS: New suggestions are distinct from previous list.');
        }

        console.log('\n--- Test 3: Wrapper Object { currentCategories: [...] } ---');
        const list3 = JSON.stringify({ currentCategories: ["Food & Dining"] });
        const res3 = await postRequest(list3);
        console.log('Suggestions 3:', res3.suggestions);
        if (!res3.suggestions || res3.suggestions.includes("Food & Dining")) {
            console.error('FAILED (Wrapper): "Food & Dining" should be excluded.');
        } else {
            console.log('SUCCESS (Wrapper): Correctly excluded.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

verify();
