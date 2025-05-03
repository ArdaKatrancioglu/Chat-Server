const express = require('express');
const http = require('http');
const path = require('path');
const initWebSocket = require('./chat_server');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const PORT = 8080;
const app = express();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

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

app.post('/api/firebase-auth', express.json(), async (req, res) => {
    const { idToken } = req.body;
  
    try {
      const decoded = await admin.auth().verifyIdToken(idToken); // Firebase token doğrula
  
      const token = uuidv4(); // geçici WS token üret
      validKeys.add(token);
      setTimeout(() => validKeys.delete(token), 5 * 60 * 1000);
  
      res.json({ token }); // frontende gönder
    } catch (e) {
      console.error("Auth error:", e);
      res.status(401).json({ error: 'Unauthorized' });
    }
});

const server = http.createServer(app);
initWebSocket(server, '/api/chat', validKeys);

server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server running at http://localhost:${PORT}`);
});