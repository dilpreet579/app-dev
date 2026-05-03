const express = require('express');
const bcrypt = require('bcrypt');

const app = express();
// Middleware to parse JSON bodies
app.use(express.json());
// Serve static frontend files from 'public' directory
app.use(express.static('public'));

// In-memory array acting as our database for this basic lab
const usersDB = [];

// 1. REGISTER API: securely hash and store user credentials
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user already exists
        const userExists = usersDB.find(u => u.username === username);
        if (userExists) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // GENERATE HASH: 
        // 10 is the "salt rounds". It determines the computational cost of hashing.
        // Higher means more secure against brute-force, but slower to compute.
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Store the user securely (NO plain text password)
        const newUser = {
            id: Date.now().toString(),
            username: username,
            passwordHash: hashedPassword // storing the hash, not the password string
        };
        
        usersDB.push(newUser);

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// 2. LOGIN API: securely verify credentials
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find the user
        const user = usersDB.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' }); // Generic error message is safer
        }

        // COMPARE PASSWORDS:
        // bcrypt securely hashes the incoming plain text password with the stored salt
        // and compares the resulting hashes.
        const isMatch = await bcrypt.compare(password, user.passwordHash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        res.status(200).json({ message: 'Login successful!' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Secure backend server running on http://localhost:${PORT}`);
});
