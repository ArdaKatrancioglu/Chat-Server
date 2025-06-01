const MessageType = {
    User: "User",
    Admin: "Admin",
    Info: "Information",
    Server: "Server"
};

let currentType = MessageType.User;

let ws;

const token = localStorage.getItem('sessionToken');
if (!token) {
  alert("You're not logged in! Please go back and log in first.");
  window.location.href = '/';
}

ws = new WebSocket(`wss://crack-aware-stud.ngrok-free.app/api/chat?token=${token}`);
const messagesDiv    = document.getElementById('messages');
const messageInput   = document.getElementById('messageInput');
const usernameInput  = document.getElementById('usernameInput');
const levelInput     = document.getElementById('levelInput');
const roomIdInput    = document.getElementById('roomIdInput');
const sendButton     = document.getElementById('sendButton');

ws.onopen = () => {
    logMessage('[System] Connected to chat server.');
    enableSendButton(true);
};

ws.onmessage = (evt) => {
    let data;
    try {
        data = JSON.parse(evt.data);
    } catch {
        console.error('Invalid JSON:', evt.data);
        return;
    }

    switch (data.type) {
        case MessageType.Server:
            logMessage(`[Server] ${data.message}`);
            break;
        case MessageType.Admin:
            logMessage(`[ADMIN]: ${data.username} ${data.message}`);
            break;
        case MessageType.Info:
            logMessage(`[Information] ${data.message}`);
            break;
        case MessageType.User:
        default:
            logMessage(`[${data.username} | Lvl ${data.level}] ${data.message}`);
            break;
    }
};

ws.onclose = (e) => {
    logMessage('[System] Disconnected from chat server.');
    enableSendButton(false);
    if (e.code === 1008) {
        alert("Invalid session. Please log in again.");
        localStorage.removeItem('sessionToken');
    }
};

ws.onerror = (err) => {
    console.error('WebSocket Error:', err);
    enableSendButton(false);
};

function sendMessage() {
    const text     = messageInput.value.trim();
    const username = usernameInput.value.trim() || "Anonymous";
    const level    = parseInt(levelInput.value, 10) || 1;
    const roomId   = roomIdInput.value.trim() || "lobby";

    if (!text || ws.readyState !== WebSocket.OPEN) return;

    const chatMsg = {
        uid: '',
        roomId: roomId,
        username: username,
        level: level,
        message: text,
        type: currentType,
        timestamp: Math.floor(Date.now() / 1000)
    };

    ws.send(JSON.stringify(chatMsg));
    messageInput.value = '';
}

function setType(type) {
    if (MessageType[type]) {
        currentType = MessageType[type];
        highlightActiveType(type);
        logMessage(`[System] Switched message type to: ${currentType}`);
    }
}

function highlightActiveType(type) {
    for (const key in MessageType) {
        const btn = document.getElementById(`${key}Btn`);
        if (btn) {
            if (key === type) {
                btn.classList.add('active-type');
            } else {
                btn.classList.remove('active-type');
            }
        }
    }
}

function enableSendButton(enable) {
    if (enable) {
        sendButton.classList.remove('disabled');
        sendButton.disabled = false;
    } else {
        sendButton.classList.add('disabled');
        sendButton.disabled = true;
    }
}

function logMessage(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    messagesDiv.appendChild(p);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        sendMessage();
        e.preventDefault();
    }
});

highlightActiveType('User');