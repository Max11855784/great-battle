const waitingQueue = [];
const activeMatches = new Map();
const userToMatch = new Map();
const userSockets = new Map();

function setUserSocket(userId, socketId) {
  userSockets.set(Number(userId), socketId);
}

function removeUserSocket(userId, socketId) {
  const numericUserId = Number(userId);

  if (userSockets.get(numericUserId) === socketId) {
    userSockets.delete(numericUserId);
  }
}

function getUserSocket(userId) {
  return userSockets.get(Number(userId)) || null;
}

function isWaiting(userId) {
  return waitingQueue.some(player => player.userId === Number(userId));
}

function addToWaitingQueue(player) {
  if (isWaiting(player.userId)) {
    return false;
  }

  waitingQueue.push({
    userId: Number(player.userId),
    login: player.login,
    avatar: player.avatar,
    socketId: player.socketId
  });

  return true;
}

function removeFromWaitingQueue(userId) {
  const numericUserId = Number(userId);
  const index = waitingQueue.findIndex(player => player.userId === numericUserId);

  if (index === -1) {
    return false;
  }

  waitingQueue.splice(index, 1);
  return true;
}

function takeWaitingOpponent(currentUserId) {
  const numericUserId = Number(currentUserId);

  for (let index = 0; index < waitingQueue.length; index++) {
    const player = waitingQueue[index];

    if (player.userId === numericUserId) {
      continue;
    }

    const socketId = getUserSocket(player.userId);

    if (!socketId) {
      waitingQueue.splice(index, 1);
      index--;
      continue;
    }

    waitingQueue.splice(index, 1);
    return {
      ...player,
      socketId
    };
  }

  return null;
}

function createActiveMatch(match) {
  activeMatches.set(Number(match.id), match);

  if (!match.player1.isBot) {
    userToMatch.set(Number(match.player1.userId), Number(match.id));
  }

  if (!match.player2.isBot) {
    userToMatch.set(Number(match.player2.userId), Number(match.id));
  }
}

function hasActiveMatch(userId) {
  return userToMatch.has(Number(userId));
}

function getActiveMatchByUserId(userId) {
  const matchId = userToMatch.get(Number(userId));

  if (!matchId) {
    return null;
  }

  return activeMatches.get(matchId) || null;
}

function clearActiveMatch(matchId) {
  const numericMatchId = Number(matchId);
  const match = activeMatches.get(numericMatchId);

  if (!match) {
    return;
  }

  if (!match.player1.isBot) {
    userToMatch.delete(Number(match.player1.userId));
  }

  if (!match.player2.isBot) {
    userToMatch.delete(Number(match.player2.userId));
  }

  activeMatches.delete(numericMatchId);
}

function clearUserActiveMatch(userId) {
  const numericUserId = Number(userId);
  const matchId = userToMatch.get(numericUserId);

  if (matchId === undefined) {
    return;
  }

  const numericMatchId = Number(matchId);
  const match = activeMatches.get(numericMatchId);

  userToMatch.delete(numericUserId);

  if (!match) {
    return;
  }

  const player1StillLinked =
    !match.player1.isBot &&
    userToMatch.get(Number(match.player1.userId)) === numericMatchId;

  const player2StillLinked =
    !match.player2.isBot &&
    userToMatch.get(Number(match.player2.userId)) === numericMatchId;

  if (!player1StillLinked && !player2StillLinked) {
    activeMatches.delete(numericMatchId);
  }
}

module.exports = {
  waitingQueue,
  activeMatches,
  userToMatch,
  userSockets,
  setUserSocket,
  removeUserSocket,
  getUserSocket,
  isWaiting,
  addToWaitingQueue,
  removeFromWaitingQueue,
  takeWaitingOpponent,
  createActiveMatch,
  hasActiveMatch,
  getActiveMatchByUserId,
  clearActiveMatch,
  clearUserActiveMatch
};
