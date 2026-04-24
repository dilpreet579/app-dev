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
        
        // 3. Collaborative Syncing - Inbound Edits
        socket.on('update', (newText) => {
            // NOTE: A true editor uses Operational Transformation (OT) or CRDT algorithms 
            // to splice content index by index. To keep the lab simple, we broadcast the entire text.
            // If the user is currently typing, this causes the cursor to jump to the end.
            
            textArea.value = newText;
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
    textArea.addEventListener('input', () => {
        if (!socket) return;
        
        const newContent = textArea.value;
        sysMessages.innerText = "Syncing...";
        
        // Emit change event to server. 
        socket.emit('edit', newContent);
        
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
