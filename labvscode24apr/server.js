const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Secret for signing JWTs
const JWT_SECRET = 'super-secret-lab-key-for-auth';

// 1. In-Memory Data Store
const users = {
    "amar": { password: "password1", role: "admin" },
    "akhbar": { password: "password1", role: "user" },
    "anthony": { password: "password1", role: "user" }
};

// Our single shared document
let documentData = {
    content: "Welcome to the collaborative editor!\nStart typing here...",
    permissions: {
        "amar": "Owner",    // full control
        "akhbar": "Editor",     // edit rights
        "anthony": "Viewer"  // read-only
    }
};

// 2. Authentication Endpoint (REST)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const user = users[username];
    if (user && user.password === password) {
        // Authenticated! Issue a JWT.
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
        
        res.json({ 
            token, 
            username,
            role: documentData.permissions[username] || 'None'
        });
    } else {
        res.status(401).json({ error: "Invalid username or password" });
    }
});

// 3. WebSocket Setup with Auth Middleware
io.use((socket, next) => {
    // Check if client provided a token
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication Error: Token missing'));
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication Error: Invalid Token'));
        // Attach username to the socket instance for future RBAC checks
        socket.username = decoded.username;
        next();
    });
});

// 4. Handle Socket Connections & Real-Time Sync
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username}`);

    const userRole = documentData.permissions[socket.username] || 'None';

    // Send the current document state immediately upon connection
    socket.emit('init', {
        content: documentData.content,
        role: userRole
    });

    // 5. Handling Operations (Naive OT Showcase)
    socket.on('edit_operation', (operation) => {
        if (userRole === 'Owner' || userRole === 'Editor') {
            // operation looks like: { type: 'insert', index: 5, text: 'a' }
            // or { type: 'delete', index: 5, length: 1 }
            
            if (operation.type === 'insert') {
                documentData.content = 
                    documentData.content.slice(0, operation.index) + 
                    operation.text + 
                    documentData.content.slice(operation.index);
            } else if (operation.type === 'delete') {
                documentData.content = 
                    documentData.content.slice(0, operation.index) + 
                    documentData.content.slice(operation.index + operation.length);
            }

            // Broadcast the operation to other users
            socket.broadcast.emit('apply_operation', operation);
            console.log(`[OP] ${operation.type} applied by ${socket.username} at index ${operation.index}`);
        } else {
            // Rejected edit (a Viewer bypassing frontend restrictions)
            console.log(`[FORBIDDEN] ${socket.username} (Viewer) attempted to edit.`);
            socket.emit('error', 'You are a Viewer and cannot edit this document.');
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.username}`);
    });
});

// 6. Flaky Analytics Endpoint (For fault-tolerance lab)
app.get('/api/doc-stats', (req, res) => {
    // Simulate flakiness: 60% chance to fail to demonstrate retries
    if (Math.random() < 0.6) {
        console.log('[API] /api/doc-stats -> SIMULATED 500 ERROR (Flaky Server)');
        return res.status(500).json({ error: "Simulated Server Error" });
    }
    
    console.log('[API] /api/doc-stats -> SUCCESS');
    res.json({
        wordCount: documentData.content.split(/\s+/).filter(w => w.length > 0).length,
        charCount: documentData.content.length,
        lastUpdated: new Date().toISOString()
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
