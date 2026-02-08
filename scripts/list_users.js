const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

// Connect to database
connectDB();

async function listUsers() {
    try {
        const users = await User.find({});
        console.log('Users found:', users.length);
        if (users.length > 0) {
            console.log('Sample User:', JSON.stringify(users[0], null, 2));
        }
        process.exit(0);
    } catch (err) {
        console.error('Error listing users:', err);
        process.exit(1);
    }
}

// Wait for connection
setTimeout(listUsers, 3000);
