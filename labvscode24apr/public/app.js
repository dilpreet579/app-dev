document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const editorContainer = document.getElementById('editor-container');
    const logoutBtn = document.getElementById('logout-btn');
    const textArea = document.getElementById('document-content');
    const sysMessages = document.getElementById('system-messages');
    
    const statsOutput = document.getElementById('stats-output');
    const offlineBanner = document.getElementById('offline-banner');

    // --- FAULT-TOLERANT DATA FETCHING LAB ---
    
    // 1. Request Deduplication Map
    const inFlightRequests = new Map();
    
    // 2. Robust Fetch Wrapper (Backoff, Retries, Deduplication, Cache)
    async function robustFetch(url, options = {}, maxRetries = 3, initialDelay = 1000) {
        // Prevent duplicate requests (if URL is already being fetched, return the existing Promise)
        const cacheKey = url;
        if (inFlightRequests.has(cacheKey)) {
            console.log(`[DEDUPLICATION] Joining existing flight pattern for: ${url}`);
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            let attempt = 0;
            let currentDelay = initialDelay;

            while (attempt <= maxRetries) {
                try {
                    // Check if browser says we are mathematically offline
                    if (!navigator.onLine) throw new Error("Browser is offline");

                    console.log(`[NETWORK] Attempting to fetch ${url} (Attempt ${attempt + 1})`);
                    const response = await fetch(url, options);

                    if (!response.ok) {
                        throw new Error(`HTTP Error Status: ${response.status}`);
                    }

                    const data = await response.json();
                    
                    // 3. Ensure Data Consistency - Save good pulls to Offline Cache
                    localStorage.setItem(`cache_${cacheKey}`, JSON.stringify(data));
                    return data;

                } catch (error) {
                    console.warn(`[FAILED] Attempt ${attempt + 1} failed: ${error.message}`);
                    
                    if (attempt >= maxRetries || !navigator.onLine) {
                        console.error(`[FALLBACK] Max retries hit or completely offline. Checking Cache...`);
                        const cachedObj = localStorage.getItem(`cache_${cacheKey}`);
                        if (cachedObj) {
                            console.log(`[FALLBACK] Loading stale data from cache.`);
                            return JSON.parse(cachedObj);
                        }
                        throw error;
                    }

                    // 4. Exponential Backoff (Wait longer each failure)
                    console.log(`[BACKOFF] Waiting ${currentDelay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, currentDelay));
                    currentDelay *= 2; 
                    attempt++;
                }
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        
        // Final Cleanup
        try {
            const result = await fetchPromise;
            inFlightRequests.delete(cacheKey);
            return result;
        } catch (e) {
            inFlightRequests.delete(cacheKey);
            throw e;
        }
    }

    // Helper functions to trigger robustFetch
    async function updateAnalytics() {
        statsOutput.innerText = "Syncing Analytics... (Check console for retries/dedup)";
        try {
            const data = await robustFetch('/api/doc-stats');
            statsOutput.innerText = `Words: ${data.wordCount} | Chars: ${data.charCount} | Last Update: ${new Date(data.lastUpdated).toLocaleTimeString()}`;
            statsOutput.style.color = "green";
        } catch (err) {
            statsOutput.innerText = `Catastrophic Failure: No cached data available.`;
            statsOutput.style.color = "red";
        }
    }

    // Attach to fake "Components"
    document.getElementById('fetch-stats-1').addEventListener('click', updateAnalytics);
    document.getElementById('fetch-stats-2').addEventListener('click', updateAnalytics);

    // 5. Native Browser Event Fallbacks
    window.addEventListener('offline', () => { 
        offlineBanner.style.display = 'block'; 
        if (socket) {
            console.log("Browser went offline. Disconnecting WebSocket.");
            socket.disconnect(); // Forcefully sever the real-time connection
        }
    });

    window.addEventListener('online', () => { 
        offlineBanner.style.display = 'none'; 
        updateAnalytics(); 
        if (socket) {
            console.log("Browser back online. Reconnecting WebSocket.");
            socket.connect(); // Re-establish the real-time connection
        }
    });

    if (!navigator.onLine) offlineBanner.style.display = 'block';
    
    // --- END FAULT-TOLERANT LAB ---

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
