const express = require('express');
const router = express.Router();
const User = require('../models/User');
const fs = require('fs');

function logError(msg) {
    fs.appendFileSync('server_error.log', new Date().toISOString() + ': ' + msg + '\n');
}

// @route   PUT /api/users
// @desc    Create or update user and add expense
// @access  Public
router.put('/users', async (req, res) => {
    console.log('PUT /users request body:', JSON.stringify(req.body));
    const { mobile, name, expense, expenses, lastinvoice } = req.body;



    // Normalize expense/expenses to a single variable
    const expenseData = expense || expenses;



    if (!mobile || !name) {
        return res.status(400).json({ msg: 'Please provide mobile number and name' });
    }

    try {
        let user = await User.findOne({ mobile });

        if (user) {
            // User exists, update name if changed and add expenses
            user.name = name;

            // Update lastinvoice if provided
            if (lastinvoice) {
                // Initialize if it doesn't exist
                if (!user.lastinvoice) {
                    user.lastinvoice = {};
                }

                // Merge fields
                if (lastinvoice.invoiceid !== undefined) user.lastinvoice.invoiceid = lastinvoice.invoiceid;
                if (lastinvoice.lastmessage !== undefined) user.lastinvoice.lastmessage = lastinvoice.lastmessage;
                if (lastinvoice.step !== undefined) user.lastinvoice.step = lastinvoice.step;
            }
            if (expenseData) {
                // expense can be a single object or an array of objects
                const expensesToProcess = Array.isArray(expenseData) ? expenseData : [expenseData];
                const processedExpenses = [];

                expensesToProcess.forEach(exp => {
                    // Pre-process category for all expenses
                    if (exp.category) {
                        const cats = Array.isArray(exp.category) ? exp.category : [exp.category];
                        exp.category = cats.map(c => {
                            if (typeof c === 'string') return c;
                            if (typeof c === 'object' && c.type) return c.type;
                            return String(c);
                        });
                    }

                    if (exp._id) {
                        // Try to find existing expense with this _id
                        const existingExpense = user.expenses.id(exp._id);

                        if (existingExpense) {
                            // Update existing expense
                            if (exp.merchant !== undefined) existingExpense.merchant = exp.merchant;
                            if (exp.amount !== undefined) existingExpense.amount = exp.amount;
                            if (exp.date !== undefined) existingExpense.date = exp.date;
                            if (exp.type !== undefined) existingExpense.type = exp.type;
                            if (exp.payingEntity !== undefined) existingExpense.payingEntity = exp.payingEntity;
                            if (exp.confirmation !== undefined) existingExpense.confirmation = exp.confirmation;
                            if (exp.category !== undefined) existingExpense.category = exp.category; // Already processed
                            if (exp.customer !== undefined) existingExpense.customer = exp.customer;
                            if (exp.project !== undefined) existingExpense.project = exp.project;
                            if (exp.note !== undefined) existingExpense.note = exp.note;
                            processedExpenses.push(existingExpense);
                        } else {
                            // Valid _id format provided but not found in subdocs? 
                            // Could be error, but standard Rest PUT usually creates if not exists (upsert) implies using that ID? 
                            // Mongoose won't let us easily "force" an _id on push unless we explicitly create the subdoc with it.
                            // But usually usage is: if _id matches, update. If not, create new (and let mongo gen new _id).
                            // User said "find we find expense through _id".
                            // If _id is passed but not found, we'll treat as new expense.
                            delete exp._id;
                            user.expenses.push(exp);
                            processedExpenses.push(user.expenses[user.expenses.length - 1]);
                        }
                    } else {
                        // No _id provided, create new expense
                        user.expenses.push(exp);
                        processedExpenses.push(user.expenses[user.expenses.length - 1]);
                    }
                });

                await user.save();
                return res.json({
                    mobile: user.mobile,
                    name: user.name,
                    lastinvoice: user.lastinvoice,
                    expenses: processedExpenses
                });
            }
            await user.save();
            return res.json({
                mobile: user.mobile,
                name: user.name,
                lastinvoice: user.lastinvoice
            });
        }

        // Create new user
        const newUserFields = {
            mobile,
            name,
            expenses: []
        };

        if (lastinvoice) {
            newUserFields.lastinvoice = lastinvoice;
        }

        if (expenseData) {
            const expensesToAdd = Array.isArray(expenseData) ? expenseData : [expenseData];
            // Fix categories in new expenses
            expensesToAdd.forEach(exp => {
                if (exp.category) {
                    const cats = Array.isArray(exp.category) ? exp.category : [exp.category];
                    exp.category = cats.map(c => {
                        if (typeof c === 'string') return c;
                        if (typeof c === 'object' && c.type) return c.type;
                        return String(c);
                    });
                }
            });
            newUserFields.expenses = expensesToAdd;
        }


        user = new User(newUserFields);
        await user.save();
        res.json(user);

    } catch (err) {
        console.error(err.message);
        logError('PUT /users Error: ' + err.message + '\nStack: ' + err.stack);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users
// @desc    Get user and specific expense based on mobile and index in body
// @access  Public
router.get('/users', async (req, res) => {
    try {
        const { mobile, name, expense } = req.body;

        if (!mobile) {
            return res.status(400).json({ msg: 'Please provide mobile number' });
        }

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Find expense if _id is provided
        let targetExpense = null;
        if (expense) {
            const expenseData = Array.isArray(expense) ? expense[0] : expense; // Take first if array
            if (expenseData && expenseData._id) {
                targetExpense = user.expenses.id(expenseData._id);
            }
        }

        res.json({
            mobile: user.mobile,
            name: user.name,
            lastinvoice: user.lastinvoice,
            expense: targetExpense
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/:mobile
// @desc    Check if user exists by mobile number
// @access  Public
// @route   GET /api/users/:mobile
// @desc    Check if user exists and return basic info
// @access  Public
router.get('/users/:mobile', async (req, res) => {
    try {
        const user = await User.findOne({ mobile: req.params.mobile });

        if (!user) {
            return res.json({ exists: false });
        }

        res.json({
            exists: true,
            mobile: user.mobile,
            name: user.name,
            lastinvoice: user.lastinvoice
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// @route   PUT /api/users/:mobile/expenses/unconfirmed
// @desc    Update the first unconfirmed expense found
// @access  Public
router.put('/users/:mobile/expenses/unconfirmed', async (req, res) => {
    try {
        const { mobile } = req.params;
        const updates = req.body;

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Find the first expense where confirmation is false (or missing)
        const expenseToUpdate = user.expenses.find(expense => expense.confirmation === false);

        if (!expenseToUpdate) {
            return res.status(404).json({ msg: 'No unconfirmed expense found' });
        }

        // Update fields if they exist in the request body
        if (updates.merchant) expenseToUpdate.merchant = updates.merchant;
        if (updates.amount) expenseToUpdate.amount = updates.amount;
        if (updates.date) expenseToUpdate.date = updates.date;
        if (updates.type) expenseToUpdate.type = updates.type;
        if (updates.payingEntity) expenseToUpdate.payingEntity = updates.payingEntity;
        if (updates.confirmation !== undefined) expenseToUpdate.confirmation = updates.confirmation;

        await user.save();
        res.json(user);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /users/:mobile/expenses/count
// @desc    Get total count of expenses for a specific user
// @access  Public
router.get('/users/:mobile/expenses/count', async (req, res) => {
    try {
        const { mobile } = req.params;
        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json({ count: user.expenses.length });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /users/:mobile/expenses/unconfirmed
// @desc    Get all unconfirmed expenses for a specific user
// @access  Public
router.get('/users/:mobile/expenses/unconfirmed', async (req, res) => {
    try {
        const { mobile } = req.params;
        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const unconfirmedExpenses = user.expenses
            .filter(expense => expense.confirmation === false)
            .map(expense => ({
                ...expense.toObject(),
                userMobile: user.mobile,
                userName: user.name,
                userId: user._id
            }));

        res.json({
            count: unconfirmedExpenses.length,
            expenses: unconfirmedExpenses
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /expenses/:id/confirm
// @desc    Confirm an expense by its ID
// @access  Public
router.put('/expenses/:id/confirm', async (req, res) => {
    try {
        const expenseId = req.params.id;

        // Find user with the expense and update it using the positional operator $
        const user = await User.findOneAndUpdate(
            { 'expenses._id': expenseId },
            { $set: { 'expenses.$.confirmation': true } },
            { new: true } // Return the updated document
        );

        if (!user) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        // Find the specific expense to return
        const confirmedExpense = user.expenses.find(exp => exp._id.toString() === expenseId);

        res.json(confirmedExpense);

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Expense not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   PUT /users/:mobile/expenses/confirm-all
// @desc    Confirm ALL unconfirmed expenses for a specific user
// @access  Public
router.put('/users/:mobile/expenses/confirm-all', async (req, res) => {
    try {
        const { mobile } = req.params;

        // Update all expenses where confirmation is false to true
        const user = await User.findOneAndUpdate(
            { mobile },
            { $set: { "expenses.$[elem].confirmation": true } },
            {
                arrayFilters: [{ "elem.confirmation": false }],
                new: true
            }
        );

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json({ msg: 'All expenses confirmed', count: user.expenses.filter(e => e.confirmation).length });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /users/:mobile/expenses/:expenseId/confirm
// @desc    Confirm an expense by its _id and mobile
// @access  Public
router.put('/users/:mobile/expenses/:expenseId/confirm', async (req, res) => {
    try {
        const { mobile, expenseId } = req.params;

        // Find user with the matching mobile and expense with specific _id & unconfirmed status
        // and update confirmation to true
        const user = await User.findOneAndUpdate(
            {
                mobile,
                'expenses._id': expenseId
            },
            { $set: { 'expenses.$.confirmation': true } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ msg: 'User not found, or Expense not found' });
        }

        // Extract the confirmed expense to return it
        const confirmedExpense = user.expenses.id(expenseId);
        res.json(confirmedExpense);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET /users/:mobile/expenses/:expenseId
// @desc    Get an expense by its _id and mobile
// @access  Public
router.get('/users/:mobile/expenses/:expenseId', async (req, res) => {
    try {
        const { mobile, expenseId } = req.params;

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const expense = user.expenses.id(expenseId);

        if (!expense) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        res.json(expense);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /users/:mobile/expenses/:expenseId
// @desc    Update expense details by _id and mobile
// @access  Public
router.put('/users/:mobile/expenses/:expenseId', async (req, res) => {
    try {
        const { mobile, expenseId } = req.params;
        const updates = req.body;

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const expenseToUpdate = user.expenses.id(expenseId);

        if (!expenseToUpdate) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        // Update fields if they exist in the request body
        if (updates.merchant) expenseToUpdate.merchant = updates.merchant;
        if (updates.amount) expenseToUpdate.amount = updates.amount;
        if (updates.date) expenseToUpdate.date = updates.date;
        if (updates.type) expenseToUpdate.type = updates.type;
        if (updates.payingEntity) expenseToUpdate.payingEntity = updates.payingEntity;

        await user.save();
        res.json(expenseToUpdate);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});





// @route   GET /users/:mobile/lastinvoice
// @desc    Get last invoice details for a specific user
// @access  Public
router.get('/users/:mobile/lastinvoice', async (req, res) => {
    try {
        const { mobile } = req.params;
        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Return the lastinvoice object directly (default values handle empty case in schema usually)
        // If it's undefined (e.g. old document), return default structure
        const lastInvoiceData = user.lastinvoice
            ? user.lastinvoice
            : { invoiceid: 0, lastmessage: "", step: 0 };

        res.json(lastInvoiceData);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /users/:mobile/lastinvoice
// @desc    Update last invoice details for a specific user
// @access  Public
router.put('/users/:mobile/lastinvoice', async (req, res) => {
    try {
        const { mobile } = req.params;
        // Allows updating via individual fields OR 'lastinvoice' object
        const { invoiceid, lastmessage, step, lastinvoice } = req.body;

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Update lastinvoice if provided as a complete object
        if (lastinvoice) {
            user.lastinvoice = lastinvoice;
        } else {
            // Otherwise, update individual fields if they exist
            if (!user.lastinvoice) {
                user.lastinvoice = {};
            }

            if (invoiceid !== undefined) user.lastinvoice.invoiceid = invoiceid;
            if (lastmessage !== undefined) user.lastinvoice.lastmessage = lastmessage;
            if (step !== undefined) user.lastinvoice.step = step;
        }

        await user.save();

        res.json(user.lastinvoice);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// List of available categories
const CATEGORIES = [
    "Food & Dining",
    "Entertainment",
    "Travel & Transport",
    "Rent & Utilities",
    "Mobile, Internet & Communication",
    "Groceries & Daily Needs",
    "Office / Work Expenses",
    "Medical & Healthcare",
    "Bills & Subscriptions",
    "Education & Learning"
];

// @route   POST /api/suggest-categories
// @desc    Get 3 categories excluding the ones provided in the request body
// @access  Public
router.post('/suggest-categories', (req, res) => {
    try {
        // Initialize with empty array if parsing fails
        let currentCategories = [];

        // Handle raw array input
        if (Array.isArray(req.body)) {
            currentCategories = req.body;
        } else if (req.body.currentCategories && Array.isArray(req.body.currentCategories)) {
            currentCategories = req.body.currentCategories;
        } else {
            // Fallback: try to convert object values to array if it looks like an array-object
            if (typeof req.body === 'object' && req.body !== null) {
                // heuristic: if keys are "0", "1"... 
                // But safer to just empty or log warning. 
                // Let's just assume empty if not array.
                // Actually, let's try Object.values() just in case it's {'0':'a','1':'b'}
                const values = Object.values(req.body);
                if (values.length > 0 && typeof values[0] === 'string') {
                    currentCategories = values;
                } else {
                    // Fallback to keys if values are empty strings (urlencoded without values)
                    // e.g. "Food & Dining=&Entertainment=" -> { "Food & Dining": "", "Entertainment": "" }
                    const keys = Object.keys(req.body);
                    if (keys.length > 0 && keys.length < 20) { // arbitrary sanity check
                        currentCategories = keys;
                    }
                }
            }
        }


        // Filter out categories that are already present in the request
        const availableCategories = CATEGORIES.filter(category => {
            const excluded = currentCategories && currentCategories.includes(category);
            // console.log(`Category: ${category}, Excluded: ${excluded}`);
            return !excluded;
        });

        // Return the first 3 available categories
        const suggestions = availableCategories.slice(0, 3);

        res.json({ suggestions });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/users/:mobile/expenses/:expenseId/categories
// @desc    Add new categories to an existing expense by _id
// @access  Public
router.post('/users/:mobile/expenses/:expenseId/categories', async (req, res) => {
    try {
        const { mobile, expenseId } = req.params;

        // Handle both { categories: [...] } and [...] formats
        let categories = req.body;
        if (req.body.categories && Array.isArray(req.body.categories)) {
            categories = req.body.categories;
        }

        if (!categories || !Array.isArray(categories)) {
            return res.status(400).json({ msg: 'Please provide an array of categories' });
        }

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const expenseToUpdate = user.expenses.id(expenseId);

        if (!expenseToUpdate) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        // Initialize category array if it doesn't exist
        if (!expenseToUpdate.category) {
            expenseToUpdate.category = [];
        }

        // Add each new category
        categories.forEach(cat => {
            if (typeof cat === 'string') {
                expenseToUpdate.category.push(cat);
            } else if (typeof cat === 'object' && cat.type) {
                expenseToUpdate.category.push(cat.type);
            } else {
                expenseToUpdate.category.push(String(cat));
            }
        });

        await user.save();

        res.json(expenseToUpdate);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
