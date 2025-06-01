const WebSocket = require('ws');

const ChatMessageType = {
    User: "User",
    Admin: "Admin",
    Info: "Information",
    Server: "Server"
};

const fs = require('fs');
const path = require('path');

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
            message: 'Connection established with Server!',
            roomId: 'lobby',
            timestamp: Math.floor(Date.now() / 1000)
        }));

        console.log('Client connected');

        ws.isAlive = true;
        ws.on('pong', () => ws.isAlive = true);

        ws.on('message', (raw) => {
            let data;
            try {
                data = JSON.parse(raw);
            } catch (err) {
                return ws.send(JSON.stringify({ type: 'Error', message: 'Invalid JSON' }));
            }

            const time = new Date(data.timestamp * 1000).toLocaleString();
            const logMsg = `[${time}] [${data.type || 'User'}] [Room: ${data.roomId || 'unknown'}] ` + `[${data.username || 'anonymous'} | Lvl ${data.level ?? '?'} | UID: ${data.uid || 'N/A'}] → ${data.message}`
            
            console.log(logMsg);
            logChatToFile(logMsg);

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

function logChatToFile(message) {
    const now = new Date();
    const logName = `logs/chat_${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}.log`;
    const logFilePath = path.join(__dirname, logName);
    fs.appendFile(logFilePath, message + '\n', (err) => {
        if (err) console.error("Failed to write chat log:", err);
    });
}

module.exports = initWebSocket;