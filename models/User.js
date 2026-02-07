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
    },type:{
        type:String,
        required:true
    },
    payingEntity:{
        type:String,
        default:"not mentioned"
    },confirmation:{
        type:Boolean,
        default:false
    },index:{
        type:Number,
        required:true
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
    lastinvoice: {
        invoiceid: { type: Number, default: 0 },
        lastmessage: { type: String, default: "" },
        step: { type: Number, default: 0 }
    },
    expenses: [ExpenseSchema]
});

module.exports = mongoose.model('User', UserSchema);
