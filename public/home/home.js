function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}
let sessionToken = null;

window.login = function () {
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;

  auth.signInWithEmailAndPassword(username, password)
    .then(userCredential => {
      return userCredential.user.getIdToken(); // Firebase ID token al
    })
    .then(idToken => {
      // Sunucuna Firebase token'ı gönder → WebSocket token al
      return fetch('/api/firebase-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
    })
    .then(res => res.json())
    .then(data => {
      if (data.token) {
        sessionToken = data.token;
        localStorage.setItem('sessionToken', sessionToken);
        alert('Login successful!');
        connectWebSocket(); // WebSocket'e bağlan
      } else {
        alert('Login failed!');
      }
    })
    .catch(error => {
      console.error(error);
      alert('Authentication error');
    });
};

function connectWebSocket() {
  const token = sessionToken || localStorage.getItem('sessionToken');
  if (!token) return alert("You must login first");

  ws = new WebSocket(`ws://localhost:8080/api/chat?token=${token}`);

  ws.onopen = () => {
    console.log('✅ WebSocket opened');
    ws.send(JSON.stringify({
      type: 'User',
      message: 'Hello from Firebase-authenticated user!'
    }));
  };

  ws.onmessage = (msg) => {
    console.log('💬 Message received:', msg.data);
  };

  ws.onclose = () => {
    console.log('🔌 WebSocket closed');
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}