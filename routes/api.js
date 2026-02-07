const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @route   PUT /api/users
// @desc    Create or update user and add expense
// @access  Public
router.put('/users', async (req, res) => {
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

                expensesToProcess.forEach(exp => {
                    if (exp.index !== undefined) {
                        // Try to find existing expense with this index
                        const existingExpense = user.expenses.find(e => e.index === exp.index);
                        if (existingExpense) {
                            // Update existing expense
                            if (exp.merchant !== undefined) existingExpense.merchant = exp.merchant;
                            if (exp.amount !== undefined) existingExpense.amount = exp.amount;
                            if (exp.date !== undefined) existingExpense.date = exp.date;
                            if (exp.type !== undefined) existingExpense.type = exp.type;
                            if (exp.payingEntity !== undefined) existingExpense.payingEntity = exp.payingEntity;
                            if (exp.confirmation !== undefined) existingExpense.confirmation = exp.confirmation;
                            if (exp.category !== undefined) {
                                if (Array.isArray(exp.category)) {
                                    existingExpense.category.push(...exp.category);
                                } else {
                                    existingExpense.category.push(exp.category);
                                }
                            }
                        } else {
                            // Add new expense with index
                            user.expenses.push(exp);
                        }
                    } else {
                        // No index provided, just push
                        user.expenses.push(exp);
                    }
                });
            }
            await user.save();
            return res.json(user);
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
            newUserFields.expenses = expensesToAdd;
        }

        user = new User(newUserFields);
        await user.save();
        res.json(user);

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

// @route   PUT /users/:mobile/expenses/:index/confirm
// @desc    Confirm an expense by its index and mobile
// @access  Public
router.put('/users/:mobile/expenses/:index/confirm', async (req, res) => {
    try {
        const { mobile, index } = req.params;

        // Find user with the matching mobile and expense with specific index & unconfirmed status
        // and update confirmation to true
        const user = await User.findOneAndUpdate(
            {
                mobile,
                expenses: {
                    $elemMatch: {
                        index: parseInt(index),
                        confirmation: false
                    }
                }
            },
            { $set: { 'expenses.$.confirmation': true } },
            { new: true }
        ).select({ expenses: { $elemMatch: { index: parseInt(index) } } }); // Return only the updated expense (optional optimization, but strict projection requires aggregation usually or careful filtering)

        // Note: mongoose findOneAndUpdate returns the whole document by default (after update if new:true)
        // If we want just the expense, we can filter it from the result or use aggregation, 
        // but returning the updated user or finding the specific subdoc is easier.
        // Let's stick to standard findOneAndUpdate without complex projection for now to be safe,
        // or re-fetch/filter from result.

        // Simpler approach compatible with previous code:
        // Re-query to return specific object or just return success message. 
        // The user likely wants the updated expense object.

        if (!user) {
            return res.status(404).json({ msg: 'User not found, or Expense not found/already confirmed' });
        }

        // Extract the confirmed expense to return it
        const confirmedExpense = user.expenses.find(exp => exp.index === parseInt(index));
        res.json(confirmedExpense);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET /users/:mobile/expenses/:index
// @desc    Get an expense by its index and mobile
// @access  Public
router.get('/users/:mobile/expenses/:index', async (req, res) => {
    try {
        const { mobile, index } = req.params;

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const expense = user.expenses.find(exp => exp.index === parseInt(index));

        if (!expense) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        res.json(expense);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /users/:mobile/expenses/:index
// @desc    Update expense details by index and mobile
// @access  Public
router.put('/users/:mobile/expenses/:index', async (req, res) => {
    try {
        const { mobile, index } = req.params;
        const updates = req.body;

        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const expenseToUpdate = user.expenses.find(exp => exp.index === parseInt(index));

        if (!expenseToUpdate) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        // Update fields if they exist in the request body
        if (updates.merchant) expenseToUpdate.merchant = updates.merchant;
        if (updates.amount) expenseToUpdate.amount = updates.amount;
        if (updates.date) expenseToUpdate.date = updates.date;
        if (updates.type) expenseToUpdate.type = updates.type;
        if (updates.payingEntity) expenseToUpdate.payingEntity = updates.payingEntity;
        // Note: Confirmation is handled by a separate endpoint, but could be added here if needed.
        // Keeping it separate as per previous specific request, but user didn't explicitly restrict it here.
        // The prompt asked for "merchant, amount, date and payingEntity".

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


module.exports = router;
