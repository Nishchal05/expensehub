const http = require('http');

// Helper wrapper for http request
function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (body) {
            options.headers['Content-Length'] = JSON.stringify(body).length;
        }

        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function start() {
    try {
        console.log('Starting verification...');

        const mobile = '9999999999';
        const index = 1;

        // 1. Create a user with an expense and initial categories
        // We'll use the existing PUT /api/users endpoint
        const setupData = {
            mobile: mobile,
            name: 'Test User',
            expense: {
                merchant: 'Test Merchant',
                amount: 100,
                type: 'Test',
                index: index
                // category: ['lunch', 'food']
            }
        };

        console.log('Setting up user...');
        const setupRes = await makeRequest('/api/users', 'PUT', setupData);
        if (setupRes.status !== 200) {
            console.error('Setup failed:', setupRes.body);
            process.exit(1);
        }
        console.log('User setup complete.');

        // 2. Add categories using the new endpoint
        const newCategories = ['travel', 'dinner'];
        console.log('Adding categories:', newCategories);

        const updateRes = await makeRequest(`/api/users/${mobile}/expenses/${index}/categories`, 'POST', { categories: newCategories });

        if (updateRes.status !== 200) {
            console.error('Update failed:', updateRes.body);
            process.exit(1);
        }

        const updatedExpense = updateRes.body;
        console.log('Updated Expense Categories:', updatedExpense.category);

        // 3. Verify
        const expected = ['lunch', 'food', 'travel', 'dinner'];
        // Check if all expected are present
        // Note: Order might be preserved or not, user asked for specific order: [lunch, food, entertaiment, ravel , dinner]
        // My code pushes, so order should be preserved.

        const actual = updatedExpense.category;
        // Map objects to strings for comparison
        const actualStrings = actual.map(c => c.type || c);

        const isExactMatch = JSON.stringify(actualStrings) === JSON.stringify(expected);

        if (isExactMatch) {
            console.log('SUCCESS: Categories match expected output.');
        } else {
            console.error('FAIL: Categories do not match.');
            console.error('Expected:', expected);
            console.error('Actual:', actualStrings);
            process.exit(1);
        }

    } catch (error) {
        console.error('Test Error:', error);
    }
}

start();
