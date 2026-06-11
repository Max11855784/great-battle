const { pool } = require('./db');
const {
  isWaiting,
  addToWaitingQueue,
  removeFromWaitingQueue,
  takeWaitingOpponent,
  createActiveMatch,
  hasActiveMatch,
  getActiveMatchByUserId
} = require('./gameState');
const { createInitialBattleState } = require('./gameLogic');

function makePlayer(user, socketId) {
  return {
    userId: Number(user.id),
    login: user.login,
    avatar: user.avatar,
    socketId
  };
}

function getOpponent(match, userId) {
  const numericUserId = Number(userId);

  if (match.player1.userId === numericUserId) {
    return match.player2;
  }

  return match.player1;
}

function buildBattleStartedPayload(match, userId) {
  const opponent = getOpponent(match, userId);

  return {
    ok: true,
    data: {
      matchId: match.id,
      opponent: {
        userId: opponent.userId,
        login: opponent.login,
        avatar: opponent.avatar
      },
      redirect: '/battle'
    }
  };
}

async function createMatch(player1, player2) {
  const [result] = await pool.query(
    'INSERT INTO matches (player1_id, player2_id, status) VALUES (?, ?, ?)',
    [player1.userId, player2.userId, 'active']
  );

  const match = await createInitialBattleState(result.insertId, player1, player2);

  createActiveMatch(match);

  return match;
}

async function findBattle(io, socket, user) {
  const currentPlayer = makePlayer(user, socket.id);

  if (hasActiveMatch(currentPlayer.userId)) {
    const match = getActiveMatchByUserId(currentPlayer.userId);

    socket.emit('battleStarted', buildBattleStartedPayload(match, currentPlayer.userId));
    return match;
  }

  if (isWaiting(currentPlayer.userId)) {
    socket.emit('matchmakingStatus', {
      ok: true,
      data: {
        status: 'waiting',
        message: 'Waiting for opponent...'
      }
    });
    return null;
  }

  const opponent = takeWaitingOpponent(currentPlayer.userId);

  if (!opponent) {
    addToWaitingQueue(currentPlayer);

    socket.emit('matchmakingStatus', {
      ok: true,
      data: {
        status: 'waiting',
        message: 'Waiting for opponent...'
      }
    });

    return null;
  }

  const opponentSocket = io.sockets.sockets.get(opponent.socketId);

  if (!opponentSocket) {
    addToWaitingQueue(currentPlayer);

    socket.emit('matchmakingStatus', {
      ok: true,
      data: {
        status: 'waiting',
        message: 'Waiting for opponent...'
      }
    });

    return null;
  }

  const match = await createMatch(opponent, currentPlayer);

  io.to(match.player1.socketId).emit(
    'battleStarted',
    buildBattleStartedPayload(match, match.player1.userId)
  );

  io.to(match.player2.socketId).emit(
    'battleStarted',
    buildBattleStartedPayload(match, match.player2.userId)
  );

  return match;
}

function cancelFindBattle(socket, user) {
  const removed = removeFromWaitingQueue(user.id);

  if (!removed) {
    socket.emit('matchmakingStatus', {
      ok: false,
      error: 'You are not waiting for opponent'
    });
    return;
  }

  socket.emit('matchmakingStatus', {
    ok: true,
    data: {
      status: 'idle',
      message: 'Search cancelled'
    }
  });
}

module.exports = {
  findBattle,
  cancelFindBattle
};
