const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    merchant: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const UserSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    expenses: [ExpenseSchema]
});

module.exports = mongoose.model('User', UserSchema);
