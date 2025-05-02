const express = require('express');
const http = require('http');
const path = require('path');
const initWebSocket = require('./chat_server');

const PORT = 8080;
const app = express();

// Serve static pages
app.use('/chat', express.static(path.join(__dirname, '..', 'public', 'chat')));
app.use('/', express.static(path.join(__dirname, '..', 'public', 'home')));

// HTML route handlers
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chat', 'index.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'home', 'index.html'));
});

const { v4: uuidv4 } = require('uuid');
const validKeys = new Set(); // temporary token storage

app.post('/api/auth', express.json(), (req, res) => {
    const { username, password } = req.body;

    // Replace this with your actual auth check
    if (username === 'admin' && password === 'secret') {
        const token = uuidv4();
        validKeys.add(token);

        // Expire token in 5 minutes
        setTimeout(() => validKeys.delete(token), 5 * 60 * 1000);

        return res.json({ token });
    }

    res.status(401).json({ error: 'Unauthorized' });
});

const server = http.createServer(app);
initWebSocket(server, '/api/chat', validKeys);

server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server running at http://localhost:${PORT}`);
});