function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
  }
let sessionToken = null;
window.login = function () {
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;

  fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.token) {
        localStorage.setItem('sessionToken', data.token);
        alert('Login successful!');
    } else {
      alert('Login failed!');
    }
  });
};

function connectWebSocket() {
  if (!window.sessionToken) return;
  const ws = new WebSocket(`ws://localhost:8080/api/chat?token=${window.sessionToken}`);

  ws.onopen = () => {
    console.log('✅ WebSocket opened');
    ws.send(JSON.stringify({ type: 'User', message: 'Hello from browser!' }));
  };

  ws.onmessage = (msg) => {
    console.log('💬', msg.data);
  };
}