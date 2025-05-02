const WebSocket = require('ws');

const SERVER_NAME = "MainServer";

const ChatMessageType = {
    User: "User",
    Admin: "Admin",
    Info: "Information",
    Server: "Server"
};

function initWebSocket(server, wsPath = '/api/chat', validKeys = new Set()) {
    const wss = new WebSocket.Server({ server, path: wsPath });

    wss.on('connection', (ws, req) => {
        // Optional: API key check
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        if (!validKeys.has(token)) {
            ws.close(1008, 'Unauthorized');
            return;
        }

        validKeys.delete(token); // one-time token

        ws.send(JSON.stringify({
            type: 'Server',
            message: 'Secure WebSocket connection established!',
            timestamp: Date.now()
        }));

        ws.isAlive = true;
        ws.on('pong', () => ws.isAlive = true);

        ws.on('message', (raw) => {
            let data;
            try {
                data = JSON.parse(raw);
            } catch (err) {
                return ws.send(JSON.stringify({ type: 'Error', message: 'Invalid JSON' }));
            }

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        });

        ws.on('close', () => console.log('Client disconnected'));
    });

    // Heartbeat
    setInterval(() => {
        wss.clients.forEach(ws => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
}

module.exports = initWebSocket;