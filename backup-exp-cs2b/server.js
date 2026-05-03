const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serves frontend HTML files

const SECRET_KEY = "super_secret_lab_key"; 

// Hardcoded dataset (In reality, this comes from a database)
let users = [
    { id: 1, username: 'admin', password: 'password123', role: 'admin' },
    { id: 2, username: 'user1', password: 'password123', role: 'user' }
];

// TASK 1: Authentication Endpoint 
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Validate credentials
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Identify role and generate a session token (JWT)
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, role: user.role });
});

// Middleware: Verify Session/Token
const authorizeUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'No token provided. Please log in.' });

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Session expired or invalid token.' });
        req.user = decoded;
        next();
    });
};

// TASK 2: Role-Based Endpoints (Authorization Layer)

// Admin Routes
app.get('/api/admin/users', authorizeUser, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied: Admins only.' });
    res.json(users);
});

app.post('/api/admin/users', authorizeUser, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied: Admins only.' });
    const { username, password, role } = req.body;
    const newId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;
    users.push({ id: newId, username, password, role: role || 'user' });
    res.json({ message: 'User added successfully!' });
});

app.delete('/api/admin/users/:id', authorizeUser, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied: Admins only.' });
    users = users.filter(u => u.id !== parseInt(req.params.id));
    res.json({ message: 'User deleted successfully!' });
});

// User Route (View own profile)
app.get('/api/user/profile', authorizeUser, (req, res) => {
    const userProfile = users.find(u => u.id === req.user.id);
    res.json(userProfile);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
