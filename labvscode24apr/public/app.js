document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const editorContainer = document.getElementById('editor-container');
    const logoutBtn = document.getElementById('logout-btn');
    const textArea = document.getElementById('document-content');
    const sysMessages = document.getElementById('system-messages');
    
    // Globals
    let socket;
    
    // 1. Auth: Handle API Login 
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        const errorElem = document.getElementById('login-error');
        errorElem.innerText = "";
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (res.ok) {
                const data = await res.json();
                
                // Keep token locally
                localStorage.setItem('lab_jwt', data.token);
                localStorage.setItem('lab_user', data.username);
                localStorage.setItem('lab_role', data.role);
                
                showEditor();
                initWebSocket(data.token); // Secure handshake
                
            } else {
                const text = await res.text();
                errorElem.innerText = `Login failed: ${text}`;
            }
        } catch (err) {
            console.error("Login Error:", err);
            errorElem.innerText = "Error connecting to server.";
        }
    });
    
    // Switch Views
    function showEditor() {
        loginContainer.style.display = 'none';
        editorContainer.style.display = 'block';
        document.getElementById('current-user').innerText = localStorage.getItem('lab_user');
        
        const role = localStorage.getItem('lab_role');
        document.getElementById('current-role').innerText = role;
        
        // --- 2. Frontend RBAC (Simulated visual security) ---
        if (role === 'Viewer') {
            textArea.disabled = true;
            textArea.style.backgroundColor = '#f4f4f4';
            sysMessages.innerText = "You are in Read-Only mode.";
        } else {
            textArea.disabled = false;
            textArea.style.backgroundColor = '#ffffff';
            sysMessages.innerText = "You are free to edit.";
        }
    }
    
    // Setup Socket connection & Handshake
    function initWebSocket(token) {
        // Authenticated connection opening
        socket = io({
            auth: { token: token }
        });
        
        // On connection approved, server immediately sends document state
        socket.on('init', (data) => {
            console.log("Document initialized:", data);
            textArea.value = data.content;
            
            // Re-enforce UI depending on role confirmed by server 
            // (avoids localStorage tampering)
            const role = data.role;
            if(role === 'Viewer') {
                textArea.disabled = true;
            }
        });
        
        // 3. Collaborative Syncing - Inbound Edits (OT conceptual)
        // Whenever the server broadcasts an atomic operation (insert or delete),
        // we apply it to the user's textarea, preserving cursor position.
        socket.on('apply_operation', (op) => {
            const cursor = textArea.selectionStart;
            let currentText = textArea.value;
            
            if (op.type === 'insert') {
                textArea.value = currentText.slice(0, op.index) + op.text + currentText.slice(op.index);
                // Adjust cursor if operation happened before cursor
                if (op.index <= cursor) {
                    textArea.setSelectionRange(cursor + op.text.length, cursor + op.text.length);
                }
            } else if (op.type === 'delete') {
                textArea.value = currentText.slice(0, op.index) + currentText.slice(op.index + op.length);
                if (op.index < cursor) {
                    const newCursor = Math.max(op.index, cursor - op.length);
                    textArea.setSelectionRange(newCursor, newCursor);
                }
            }
        });

        // Backend security rejection messages
        socket.on('error', (errMsg) => {
            sysMessages.innerText = `[SERVER ERROR]: ${errMsg}`;
            sysMessages.style.color = "red";
        });
        
        socket.on('connect_error', (err) => {
            console.error('Socket Auth Error:', err.message);
            sysMessages.innerText = "WebSocket connection failed: " + err.message;
            sysMessages.style.color = "red";
        });
    }
    
    // 4. Collaborative Syncing - Outbound Edits
    // By tracking before-input data, we generate an "Operation" (OT Concept)
    let previousValue = '';
    textArea.addEventListener('focus', () => previousValue = textArea.value);
    
    textArea.addEventListener('input', (e) => {
        if (!socket) return;
        sysMessages.innerText = "Syncing Operation...";
        
        let currentValue = textArea.value;
        
        // Find basic diff (Insert vs Delete)
        // Note: For a lab, this simple String diff simulates how true OT starts gathering ops.
        const cursorPosition = textArea.selectionStart;
        
        if (currentValue.length > previousValue.length) {
            // Something was inserted
            const diffSize = currentValue.length - previousValue.length;
            const insertIndex = cursorPosition - diffSize;
            const insertedText = currentValue.slice(insertIndex, cursorPosition);
            
            socket.emit('edit_operation', { type: 'insert', index: insertIndex, text: insertedText });
            
        } else if (currentValue.length < previousValue.length) {
            // Something was deleted
            const diffSize = previousValue.length - currentValue.length;
            const deleteIndex = cursorPosition; 
            
            socket.emit('edit_operation', { type: 'delete', index: deleteIndex, length: diffSize });
        }
        
        previousValue = currentValue;
        
        setTimeout(() => {
             sysMessages.innerText = "Saved.";
        }, 500);
    });
    
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        if(socket) socket.disconnect();
        loginContainer.style.display = 'block';
        editorContainer.style.display = 'none';
    });
    
    // Restore session if user reloads page
    if (localStorage.getItem('lab_jwt')) {
        showEditor();
        initWebSocket(localStorage.getItem('lab_jwt'));
    }
});
