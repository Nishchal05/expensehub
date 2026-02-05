const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @route   PUT /api/users
// @desc    Create or update user and add expense
// @access  Public
router.put('/users', async (req, res) => {
    const { mobile, name, expense } = req.body;

    if (!mobile || !name) {
        return res.status(400).json({ msg: 'Please provide mobile number and name' });
    }

    try {
        let user = await User.findOne({ mobile });

        if (user) {
            // User exists, update name if changed and add expenses
            user.name = name;
            if (expense) {
                // expense can be a single object or an array of objects
                const expensesToAdd = Array.isArray(expense) ? expense : [expense];
                user.expenses.push(...expensesToAdd);
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

        if (expense) {
            const expensesToAdd = Array.isArray(expense) ? expense : [expense];
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
// @desc    Get user by mobile number
// @access  Public
router.get('/users/:mobile', async (req, res) => {
    try {
        const user = await User.findOne({ mobile: req.params.mobile });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        if (err.kind == 'ObjectId') {
            return res.status(404).json({ msg: 'User not found' });
        }
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

module.exports = router;
