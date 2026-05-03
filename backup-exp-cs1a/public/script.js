document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const messageDiv = document.getElementById('reg-message');

    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        messageDiv.textContent = data.message || data.error;
        messageDiv.style.color = res.ok ? 'green' : 'red';
        
        if (res.ok) document.getElementById('registerForm').reset();
    } catch (err) {
        messageDiv.textContent = 'Error connecting to server';
        messageDiv.style.color = 'red';
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const messageDiv = document.getElementById('login-message');

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        messageDiv.textContent = data.message || data.error;
        messageDiv.style.color = res.ok ? 'green' : 'red';
        
        if (res.ok) document.getElementById('loginForm').reset();
    } catch (err) {
        messageDiv.textContent = 'Error connecting to server';
        messageDiv.style.color = 'red';
    }
});