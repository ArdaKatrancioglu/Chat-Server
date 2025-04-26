const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = 8080;
const SERVER_NAME = "MainServer";

const ChatMessageType = {
    User: "User",
    Admin: "Admin",
    Info: "Information",
    Server: "Server"
};

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.isAlive = true;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    const welcomeMessage = {
        type: ChatMessageType.Server,
        username: SERVER_NAME,
        roomId: "lobby",
        message: "Connection established with Server!",
        timestamp: Math.floor(Date.now() / 1000)
    };
    ws.send(JSON.stringify(welcomeMessage));

    ws.on('message', (rawMessage) => {
        let parsed;
        try {
            parsed = JSON.parse(rawMessage.toString());
        } catch (err) {
            console.error('Invalid JSON received:', rawMessage.toString());
            return;
        }

        console.log(`[${parsed.username || 'Anonymous'} | Room: ${parsed.roomId || 'unknown'}]: ${parsed.message}`);

        const outgoing = {
            ...parsed,
            type: parsed.type || ChatMessageType.User,
            timestamp: parsed.timestamp || Math.floor(Date.now() / 1000)
        };

        const outgoingRaw = JSON.stringify(outgoing);

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(outgoingRaw);
            }
        });
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server running at http://localhost:${PORT}`);
});

// Heartbeat every 30 seconds
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('Terminating dead client');
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping(() => {}); // Force a ping, wait for pong
    });
}, 30000); // every 30 seconds