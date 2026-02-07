const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load env vars
dotenv.config({ path: 'c:/expensehub.io/.env' }); // Adjust path if needed, usually .env is in root

const insertUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const mobile = "91 84479 23656";
        const name = "Abhiranjan Shukla";

        let user = await User.findOne({ mobile });

        if (user) {
            console.log('User already exists:', user);
        } else {
            user = new User({
                mobile,
                name,
                expenses: []
            });
            await user.save();
            console.log('User created successfully:', user);
        }

        mongoose.connection.close();
    } catch (err) {
        console.error('Error inserting user:', err);
        process.exit(1);
    }
};

insertUser();
