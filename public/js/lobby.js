const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');

const findBattleBtn = document.getElementById('find-battle-btn');
const practiceAiBtn = document.getElementById('practice-ai-btn');
const cancelBattleBtn = document.getElementById('cancel-battle-btn');
const searchStatus = document.getElementById('search-status');
const statusMessage = document.getElementById('status-message');

let socket = null;

function setWaitingMode(message) {
  findBattleBtn.style.display = 'none';
  practiceAiBtn.style.display = 'none';
  cancelBattleBtn.style.display = 'block';
  searchStatus.style.display = 'block';
  statusMessage.textContent = message || 'Waiting for opponent...';
}

function setIdleMode(message) {
  findBattleBtn.style.display = 'block';
  practiceAiBtn.style.display = 'block';
  cancelBattleBtn.style.display = 'none';
  searchStatus.style.display = message ? 'block' : 'none';
  statusMessage.textContent = message || '';

  findBattleBtn.disabled = false;
  practiceAiBtn.disabled = false;
}

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/me');
    const result = await response.json();

    if (!result.ok) {
      window.location.href = '/login';
      return;
    }

    userName.textContent = result.data.user.login;
    userAvatar.src = result.data.user.avatar;
  } catch (error) {
    window.location.href = '/login';
  }
}

function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    setIdleMode('');
  });

  socket.on('socketReady', () => {
    setIdleMode('');
  });

  socket.on('matchmakingStatus', (result) => {
    if (!result.ok) {
      setIdleMode(result.error);
      return;
    }

    if (result.data.status === 'waiting') {
      setWaitingMode(result.data.message);
      return;
    }

    setIdleMode(result.data.message);
  });

  socket.on('battleStarted', (result) => {
    if (!result.ok) {
      setIdleMode(result.error || 'Battle start failed');
      return;
    }

    searchStatus.style.display = 'block';
    statusMessage.textContent = `Opponent found: ${result.data.opponent.login}. Entering battle...`;

    window.location.href = result.data.redirect;
  });

  socket.on('battleError', (result) => {
    setIdleMode(result.error || 'Battle error');
  });

  socket.on('authError', () => {
    window.location.href = '/login';
  });

  socket.on('disconnect', () => {
    setIdleMode('Disconnected from server');
  });
}

findBattleBtn.addEventListener('click', () => {
  if (!socket || !socket.connected) {
    setIdleMode('Socket is not connected');
    return;
  }

  socket.emit('findBattle');
});

practiceAiBtn.addEventListener('click', () => {
  if (!socket || !socket.connected) {
    setIdleMode('Socket is not connected');
    return;
  }

  findBattleBtn.disabled = true;
  practiceAiBtn.disabled = true;

  searchStatus.style.display = 'block';
  statusMessage.textContent = 'Starting Practice vs AI...';

  socket.emit('startAiBattle');
});

cancelBattleBtn.addEventListener('click', () => {
  if (!socket || !socket.connected) {
    setIdleMode('Socket is not connected');
    return;
  }

  socket.emit('cancelFindBattle');
});

logoutBtn.addEventListener('click', async () => {
  try {
    if (socket) {
      socket.disconnect();
    }

    const response = await fetch('/api/logout', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.ok) {
      window.location.href = result.data.redirect;
      return;
    }

    window.location.href = '/';
  } catch (error) {
    window.location.href = '/';
  }
});

loadCurrentUser();
connectSocket();
