const timer = document.getElementById('timer');
const turnLabel = document.getElementById('turn-label');

const opponentLogin = document.getElementById('opponent-login');
const opponentAvatar = document.getElementById('opponent-avatar');
const opponentHp = document.getElementById('opponent-hp');
const opponentMana = document.getElementById('opponent-mana');
const opponentHandCount = document.getElementById('opponent-hand-count');
const opponentHealthFill = document.getElementById('opponent-health-fill');
const opponentFaction = document.getElementById('opponent-faction');

const myLogin = document.getElementById('my-login');
const myAvatar = document.getElementById('my-avatar');
const myHp = document.getElementById('my-hp');
const myManaTop = document.getElementById('my-mana-top');
const myHealthFill = document.getElementById('my-health-fill');
const myFaction = document.getElementById('my-faction');

const sideFaction = document.getElementById('side-faction');
const manaCurrent = document.getElementById('mana-current');
const manaMax = document.getElementById('mana-max');
const battleStatus = document.getElementById('battle-status');

const opponentField = document.getElementById('opponent-field');
const playerField = document.getElementById('player-field');
const hand = document.getElementById('hand');
const battleLogList = document.getElementById('battle-log-list');

const attackEndTurnBtn = document.getElementById('attack-end-turn-btn');
const giveUpBtn = document.getElementById('give-up-btn');

const resultModal = document.getElementById('result-modal');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');

let socket = null;
let latestState = null;
let countdownInterval = null;

function clearElement(element) {
  element.innerHTML = '';
}

function setStatus(message) {
  battleStatus.textContent = message;
}

function formatFaction(faction) {
  return faction === 'hero' ? 'Heroes' : 'Villains';
}

function applyFactionBadge(element, faction) {
  element.textContent = formatFaction(faction);
  element.className = `faction-badge faction-${faction}`;
}

function setBattleAvatar(imageElement, avatarPath) {
  if (!imageElement) {
    return;
  }

  const defaultAvatar = '/images/avatars/avatar_men.png';

  imageElement.src = avatarPath || defaultAvatar;

  imageElement.onerror = () => {
    imageElement.onerror = null;
    imageElement.src = defaultAvatar;
  };
}

function createEmptyMessage(text) {
  const message = document.createElement('div');
  message.className = 'empty-zone-message';
  message.textContent = text;
  return message;
}

function createCardElement(card, options = {}) {
  const cardElement = document.createElement('div');
  cardElement.className = `game-card card-faction-${card.faction}`;

  if (options.clickable) {
    cardElement.classList.add('clickable-card');
  }

  if (options.disabled) {
    cardElement.classList.add('disabled-card');
  }
  const isInHand = options.clickable;
  const defenseValue = card.currentDefense ?? card.defense;
  const defensePercent = Math.max(0, Math.min(100, (defenseValue / card.defense) * 100));

  cardElement.innerHTML = `
    <div class="card-top">
      <span class="card-faction-mini">${formatFaction(card.faction)}</span>
      ${isInHand
        ? `<span class="card-cost">${card.cost}</span>`
        : `<div class="card-health-bar"><div class="health-fill" style="width:${defensePercent}%"></div></div>`
      }
    </div>
    <div class="card-image">
      <img src="${card.image}" alt="${card.alias}">
    </div>
    <div class="card-name">${card.alias}</div>
    <div class="card-bottom">
      <div class="stat attack-stat">${card.attack}</div>
      <div class="stat defense-stat">${card.currentDefense}</div>
    </div>
  `;

  const img = cardElement.querySelector('img');
  img.onerror = () => {
    img.src = '/images/cards/ant_man.webp';
  };

  if (options.clickable && !options.disabled) {
    cardElement.addEventListener('click', () => {
      socket.emit('playCard', {
        instanceId: card.instanceId
      });
    });
  }

  if (options.returnable && !options.disabled) {
    cardElement.addEventListener('click', () => {
      socket.emit('returnCard', { 
        instanceId: card.instanceId 
      });
    });
  }

  return cardElement;
}

function renderCards(container, cards, emptyText, options = {}) {
  clearElement(container);

  if (!cards || cards.length === 0) {
    container.appendChild(createEmptyMessage(emptyText));
    return;
  }

  cards.forEach((card) => {
    container.appendChild(createCardElement(card, options));
  });
}

function renderHand(state) {
  clearElement(hand);

  if (!state.me.hand || state.me.hand.length === 0) {
    hand.appendChild(createEmptyMessage('Your hand is empty.'));
    return;
  }

  const isMyTurn = state.currentTurnUserId === state.me.userId;
  const activeLimitReached = state.me.activeCards.length >= state.maxActiveCards;

  state.me.hand.forEach((card) => {
    const disabled = !isMyTurn || activeLimitReached || card.cost > state.me.mana;

    hand.appendChild(createCardElement(card, {
      clickable: true,
      disabled
    }));
  });
}

function renderLogs(logs) {
  clearElement(battleLogList);

  if (!logs || logs.length === 0) {
    battleLogList.appendChild(createEmptyMessage('No events yet.'));
    return;
  }

  logs.slice(-10).forEach((message) => {
    const item = document.createElement('div');
    item.className = 'battle-log-item';
    item.textContent = message;
    battleLogList.appendChild(item);
  });

  battleLogList.scrollTop = battleLogList.scrollHeight;
}

function updateHealthBar(element, hp) {
  const width = Math.max(0, Math.min(100, (hp / 20) * 100));
  element.style.width = `${width}%`;
}

function startCountdown(turnEndsAt) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  function updateTimer() {
    const secondsLeft = Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000));
    timer.textContent = secondsLeft;
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 500);
}

function renderBattleState(state) {
  latestState = state;

  const isMyTurn = state.currentTurnUserId === state.me.userId;

  turnLabel.textContent = isMyTurn ? 'Your turn' : 'Enemy turn';

  opponentLogin.textContent = state.opponent.login;
  setBattleAvatar(opponentAvatar, state.opponent.avatar);
  opponentHp.textContent = state.opponent.hp;
  opponentMana.textContent = state.opponent.mana;
  opponentHandCount.textContent = state.opponent.handCount;
  updateHealthBar(opponentHealthFill, state.opponent.hp);
  applyFactionBadge(opponentFaction, state.opponent.faction);

  myLogin.textContent = state.me.login;
  setBattleAvatar(myAvatar, state.me.avatar);
  myHp.textContent = state.me.hp;
  myManaTop.textContent = state.me.mana;
  updateHealthBar(myHealthFill, state.me.hp);
  applyFactionBadge(myFaction, state.me.faction);

  sideFaction.textContent = formatFaction(state.me.faction);
  sideFaction.className = `side-faction-text faction-text-${state.me.faction}`;

  manaCurrent.textContent = state.me.mana;
  manaMax.textContent = state.maxMana;

  renderCards(opponentField, state.opponent.activeCards, 'No active cards.');
  renderCards(playerField, state.me.activeCards, 'No active cards.', { returnable: isMyTurn });
  renderHand(state);
  renderLogs(state.logs);

  attackEndTurnBtn.disabled = !isMyTurn;

  if (!isMyTurn) {
    setStatus(`Waiting for ${state.opponent.login}...`);
  } else if (state.me.activeCards.length >= state.maxActiveCards) {
    setStatus('Active cards limit reached. You can use Attack & End Turn.');
  } else {
    setStatus(`You fight for ${formatFaction(state.me.faction)}. Play cards or use Attack & End Turn.`);
  }

  startCountdown(state.turnEndsAt);
}

function showBattleResult(data) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  resultTitle.textContent = data.result === 'win' ? 'Victory' : 'Defeat';
  resultMessage.textContent = data.message;
  resultModal.style.display = 'flex';
}

function connectSocket() {
  socket = io();

  socket.on('socketReady', () => {
    socket.emit('getBattleState');
  });

  socket.on('battleState', (result) => {
    if (!result.ok) {
      window.location.href = '/lobby';
      return;
    }

    renderBattleState(result.data);
  });

  socket.on('battleEnded', (result) => {
    if (!result.ok) {
      setStatus(result.error || 'Battle ended with error');
      return;
    }

    showBattleResult(result.data);
  });

  socket.on('battleError', (result) => {
    setStatus(result.error || 'Battle error');

    if (latestState) {
      renderBattleState(latestState);
    }
  });

  socket.on('authError', () => {
    window.location.href = '/login';
  });
}

giveUpBtn.addEventListener('click', () => {
  if (!socket || !socket.connected) {
    setStatus('Socket is not connected');
    return;
  }

  if (!latestState) {
    return;
  }

  const confirmed = confirm('Are you sure? This will count as defeat.');

  if (!confirmed) {
    return;
  }

  giveUpBtn.disabled = true;
  socket.emit('giveUp');
});

attackEndTurnBtn.addEventListener('click', () => {
  if (!socket || !socket.connected) {
    setStatus('Socket is not connected');
    return;
  }

  if (!latestState || latestState.currentTurnUserId !== latestState.me.userId) {
    setStatus('It is not your turn');
    return;
  }

  attackEndTurnBtn.disabled = true;
  socket.emit('endTurn');
});

backToLobbyBtn.addEventListener('click', () => {
  window.location.href = '/lobby';
});

connectSocket();