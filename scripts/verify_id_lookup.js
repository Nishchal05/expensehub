const http = require('http');

// Configuration
const PORT = 5000;
const HOST = 'localhost';

// Helper wrapper for http request
function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
        }

        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsedBody = data;
                try {
                    parsedBody = JSON.parse(data);
                } catch (e) {
                    // keep as string
                }
                resolve({ status: res.statusCode, body: parsedBody });
            });
        });

        req.on('error', (e) => {
            if (e.code === 'ECONNREFUSED') {
                reject(new Error(`Connection refused at ${HOST}:${PORT}. Is the server running?`));
            } else {
                reject(e);
            }
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(`Starting Verification on http://${HOST}:${PORT}`);

    // Retry connection check
    let retries = 5;
    while (retries > 0) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
                    resolve();
                }).on('error', reject);
            });
            console.log("Server is reachable.");
            break;
        } catch (e) {
            console.log(`Waiting for server... (${retries} retries left)`);
            await sleep(2000);
            retries--;
        }
    }

    if (retries === 0) {
        console.error("Server not reachable after retries.");
        process.exit(1);
    }

    const mobile = '9876543210'; // Test mobile

    try {
        console.log('\n--- Step 1: Creating User with Expense ---');
        const createPayload = {
            mobile: mobile,
            name: "TestIdLookup",
            expense: {
                merchant: "Initial Merchant",
                amount: 100,
                type: "Test",
                date: new Date().toISOString()
            }
        };

        const createRes = await makeRequest('/api/users', 'PUT', createPayload);
        if (createRes.status !== 200) {
            console.error(`Failed to create user: ${JSON.stringify(createRes.body)}`);
            process.exit(1);
        }
        console.log('User created/updated.');

        const userExpenses = createRes.body.expenses;

        // Take the last expense as the one we just added (since we are appending)
        const createdExpense = userExpenses[userExpenses.length - 1];

        if (!createdExpense || !createdExpense._id) {
            console.log("FATAL: Created expense not found or missing _id");
            console.log("Expenses:", JSON.stringify(userExpenses, null, 2));
            process.exit(1);
        }
        const expenseId = createdExpense._id;
        console.log(`Target Expense ID: ${expenseId}`);

        // Step 2: Update Expense using _id
        console.log('\n--- Step 2: Updating Expense using _id ---');
        const updatePayload = {
            mobile: mobile,
            name: "TestIdLookup",
            expense: {
                _id: expenseId,
                amount: 500,
                merchant: "Updated Merchant"
            }
        };

        const updateRes = await makeRequest('/api/users', 'PUT', updatePayload);
        if (updateRes.status !== 200) {
            console.error(`Failed to update expense: ${JSON.stringify(updateRes.body)}`);
            process.exit(1);
        }

        const updatedExpenseInRes = updateRes.body.expenses.find(e => e._id === expenseId);
        if (!updatedExpenseInRes) {
            console.error("Updated expense not found in response");
            process.exit(1);
        }

        if (updatedExpenseInRes.amount !== 500) {
            console.error(`Update response data mismatch. Expected 500, got ${updatedExpenseInRes.amount}`);
            process.exit(1);
        }
        console.log('Update successful (verified via response).');

        // Step 3: Verify with GET using _id
        console.log('\n--- Step 3: Verifying with GET /api/users using _id ---');
        const getPayload = {
            mobile: mobile,
            expense: {
                _id: expenseId
            }
        };

        // Sending body with GET
        const getRes2 = await makeRequest('/api/users', 'GET', getPayload);

        if (getRes2.status !== 200) {
            console.error(`Failed to GET expense: ${JSON.stringify(getRes2.body)}`);
            process.exit(1);
        }

        const fetchedExpense = getRes2.body.expense;
        if (!fetchedExpense) {
            console.error('GET response missing "expense" field', getRes2.body);
            process.exit(1);
        }
        if (fetchedExpense._id !== expenseId) {
            console.error(`GET fetched wrong expense ID: ${fetchedExpense._id}`);
            process.exit(1);
        }
        if (fetchedExpense.amount !== 500) {
            console.error(`GET verified failed. Expected 500, got ${fetchedExpense.amount}`);
            process.exit(1);
        }

        console.log(`GET Verified: Amount is ${fetchedExpense.amount}`);
        console.log('\n✅ TEST PASSED: _id lookup working including GET.');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        process.exit(1);
    }
}

runTest();
