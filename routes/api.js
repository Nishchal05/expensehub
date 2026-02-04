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

module.exports = router;
