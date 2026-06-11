const { getUserById } = require('./auth');
const {
  setUserSocket,
  removeUserSocket,
  removeFromWaitingQueue,
  getActiveMatchByUserId,
  getUserSocket,
  clearActiveMatch,
  clearUserActiveMatch
} = require('./gameState');
const {
  findBattle,
  cancelFindBattle
} = require('./matchmaking');
const {
  buildBattleStateForUser,
  buildBattleEndedPayload,
  playCard,
  returnCard,
  attackAndEndTurn,
  giveUp,
  finishBattleByDisconnect
} = require('./gameLogic');

const {
  createAiBattle,
  isBotTurn,
  performFallbackBotTurn
} = require('./services/aiBattleService');

function clearTurnTimeout(match) {
  if (match && match.turnTimer) {
    clearTimeout(match.turnTimer);
    match.turnTimer = null;
  }
}

function emitBattleStateToUser(io, match, userId) {
  const socketId = getUserSocket(userId);

  if (!socketId) {
    return;
  }

  const battleState = buildBattleStateForUser(match, userId);

  io.to(socketId).emit('battleState', {
    ok: true,
    data: battleState
  });
}

function broadcastBattleState(io, match) {
  emitBattleStateToUser(io, match, match.player1.userId);
  emitBattleStateToUser(io, match, match.player2.userId);
}

function broadcastBattleEnded(io, match) {
  const player1SocketId = getUserSocket(match.player1.userId);
  const player2SocketId = getUserSocket(match.player2.userId);

  if (player1SocketId) {
    io.to(player1SocketId).emit('battleEnded', {
      ok: true,
      data: buildBattleEndedPayload(match, match.player1.userId)
    });
  }

  if (player2SocketId) {
    io.to(player2SocketId).emit('battleEnded', {
      ok: true,
      data: buildBattleEndedPayload(match, match.player2.userId)
    });
  }
}

function scheduleTurnTimeout(io, match) {
  if (!match || match.status !== 'active') {
    return;
  }

  if (isBotTurn(match)) {
    runBotTurnIfNeeded(io, match);
    return;
  }

  clearTurnTimeout(match);

  const delayMs = Math.max(0, match.turnEndsAt - Date.now());

  match.turnTimer = setTimeout(async () => {
    try {
      if (!match || match.status !== 'active') {
        return;
      }

      const currentTurnUserId = match.currentTurnUserId;
      const result = await attackAndEndTurn(match, currentTurnUserId, {
        reason: 'timeout'
      });

      if (!result.ok) {
        return;
      }

      if (result.battleEnded) {
        clearTurnTimeout(match);
        broadcastBattleEnded(io, match);
        clearActiveMatch(match.id);
        return;
      }

      broadcastBattleState(io, match);
      scheduleTurnTimeout(io, match);
    } catch (error) {
      console.error(error);
    }
  }, delayMs + 250);
}

function runBotTurnIfNeeded(io, match) {
  if (!match || match.status !== 'active') {
    return;
  }

  if (!isBotTurn(match)) {
    return;
  }

  if (match.botThinking) {
    return;
  }

  clearTurnTimeout(match);

  match.botThinking = true;
  match.logs.push('AI is thinking...');

  broadcastBattleState(io, match);

  setTimeout(async () => {
    try {
      if (!match || match.status !== 'active') {
        return;
      }

      const result = await performFallbackBotTurn(match);

      match.botThinking = false;

      if (!result.ok) {
        match.logs.push('AI failed to make a move.');
        broadcastBattleState(io, match);
        scheduleTurnTimeout(io, match);
        return;
      }

      if (result.battleEnded) {
        clearTurnTimeout(match);
        broadcastBattleEnded(io, match);
        clearActiveMatch(match.id);
        return;
      }

      broadcastBattleState(io, match);
      scheduleTurnTimeout(io, match);
    } catch (error) {
      console.error(error);

      match.botThinking = false;
      match.logs.push('AI error. Turn was skipped.');

      broadcastBattleState(io, match);
      scheduleTurnTimeout(io, match);
    }
  }, 1400);
}

function sendBattleState(socket, userId) {
  const match = getActiveMatchByUserId(userId);

  if (!match) {
    socket.emit('battleError', {
      ok: false,
      error: 'No active battle'
    });
    return;
  }

  if (match.status === 'finished') {
    socket.emit('battleEnded', {
      ok: true,
      data: buildBattleEndedPayload(match, userId)
    });

    clearUserActiveMatch(userId);
    return;
  }

  const battleState = buildBattleStateForUser(match, userId);

  socket.emit('battleState', {
    ok: true,
    data: battleState
  });
}

async function finishBattleOnDisconnect(io, userId) {
  const match = getActiveMatchByUserId(userId);

  if (!match || match.status !== 'active') {
    return;
  }

  clearTurnTimeout(match);

  const result = await finishBattleByDisconnect(match, userId);

  if (!result.ok) {
    return;
  }

  broadcastBattleEnded(io, match);

  if (!match.isAi) {
    clearUserActiveMatch(result.winnerId);
  }

  setTimeout(() => {
    const loserMatch = getActiveMatchByUserId(result.loserId);

    if (
      loserMatch &&
      Number(loserMatch.id) === Number(match.id) &&
      loserMatch.status !== 'active'
    ) {
      clearUserActiveMatch(result.loserId);
    }
  }, 1000 * 60 * 5);
}

function broadcastRevealState(io, match) {
  [match.player1, match.player2].forEach(player => {
    const socketId = getUserSocket(player.userId);

    if (!socketId) {
      return;
    }

    const opponent = match.player1.userId === player.userId
      ? match.player2
      : match.player1;

    const state = buildBattleStateForUser(match, player.userId);

    if (!state) {
      return;
    }

    state.opponent.activeCards = opponent.activeCards;

    io.to(socketId).emit('battleState', {
      ok: true,
      data: state
    });
  });
}

function attachSocketHandlers(io) {
  io.on('connection', async (socket) => {
    try {
      const session = socket.request.session;

      if (!session || !session.userId) {
        socket.emit('authError', {
          ok: false,
          error: 'Not authenticated'
        });

        socket.disconnect(true);
        return;
      }

      const user = await getUserById(session.userId);

      if (!user) {
        socket.emit('authError', {
          ok: false,
          error: 'User not found'
        });

        socket.disconnect(true);
        return;
      }

      setUserSocket(user.id, socket.id);

      socket.emit('socketReady', {
        ok: true,
        data: {
          user
        }
      });

      socket.on('findBattle', async () => {
        try {
          const match = await findBattle(io, socket, user);

          if (match) {
            scheduleTurnTimeout(io, match);
          }
        } catch (error) {
          console.error(error);

          socket.emit('battleError', {
            ok: false,
            error: 'Failed to find battle'
          });
        }
      });

      socket.on('cancelFindBattle', () => {
        cancelFindBattle(socket, user);
      });

      socket.on('startAiBattle', async () => {
        try {
          removeFromWaitingQueue(user.id);

          const existingMatch = getActiveMatchByUserId(user.id);

          if (existingMatch) {
            const opponent = existingMatch.player1.userId === Number(user.id)
              ? existingMatch.player2
              : existingMatch.player1;

            socket.emit('battleStarted', {
              ok: true,
              data: {
                matchId: existingMatch.id,
                opponent: {
                  userId: opponent.userId,
                  login: opponent.login,
                  avatar: opponent.avatar
                },
                redirect: '/battle'
              }
            });

            scheduleTurnTimeout(io, existingMatch);
            return;
          }

          const match = await createAiBattle(user, socket.id);

          const opponent = match.player1.userId === Number(user.id)
            ? match.player2
            : match.player1;

          socket.emit('battleStarted', {
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
          });

          scheduleTurnTimeout(io, match);
        } catch (error) {
          console.error(error);

          socket.emit('battleError', {
            ok: false,
            error: 'Failed to start AI battle'
          });
        }
      });

      socket.on('getBattleState', () => {
        const match = getActiveMatchByUserId(user.id);

        if (match) {
          socket.data.inBattle = true;
          scheduleTurnTimeout(io, match);
        }

        sendBattleState(socket, user.id);
      });

      socket.on('playCard', (payload) => {
        const match = getActiveMatchByUserId(user.id);

        if (!match) {
          socket.emit('battleError', {
            ok: false,
            error: 'No active battle'
          });
          return;
        }

        const result = playCard(match, user.id, payload.instanceId);

        if (!result.ok) {
          socket.emit('battleError', {
            ok: false,
            error: result.error
          });
          return;
        }

        broadcastBattleState(io, match);
      });

      socket.on('returnCard', (payload) => {
        const match = getActiveMatchByUserId(user.id);
        if (!match) {
          socket.emit('battleError', { ok: false, error: 'No active battle' });
          return;
        }

        const result = returnCard(match, user.id, payload.instanceId);
        if (!result.ok) {
          socket.emit('battleError', { ok: false, error: result.error });
          return;
        }

        broadcastBattleState(io, match);
      });

      socket.on('endTurn', async () => {
        try {
          const match = getActiveMatchByUserId(user.id);
          if (!match) {
            socket.emit('battleError', { ok: false, error: 'No active battle' });
            return;
          }

          clearTurnTimeout(match);

          broadcastRevealState(io, match);
          await new Promise(resolve => setTimeout(resolve, 2000));

          const result = await attackAndEndTurn(match, user.id);

          if (!result.ok) {
            socket.emit('battleError', { ok: false, error: result.error });
            scheduleTurnTimeout(io, match);
            return;
          }

          if (result.battleEnded) {
            clearTurnTimeout(match);
            broadcastBattleEnded(io, match);
            clearActiveMatch(match.id);
            return;
          }

          broadcastBattleState(io, match);
          scheduleTurnTimeout(io, match);
        } catch (error) {
          console.error(error);
          socket.emit('battleError', { ok: false, error: 'Failed to end turn' });
        }
      });

      socket.on('giveUp', async () => {
        try {
          const match = getActiveMatchByUserId(user.id);

          if (!match) {
            socket.emit('battleError', {
              ok: false,
              error: 'No active battle'
            });
            return;
          }

          clearTurnTimeout(match);

          const result = await giveUp(match, user.id);

          if (!result.ok) {
            socket.emit('battleError', {
              ok: false,
              error: result.error
            });
            return;
          }

          broadcastBattleEnded(io, match);
          clearActiveMatch(match.id);
        } catch (error) {
          console.error(error);

          socket.emit('battleError', {
            ok: false,
            error: 'Failed to give up'
          });
        }
      });

      socket.on('disconnect', async () => {
        try {
          removeFromWaitingQueue(user.id);

          if (socket.data.inBattle) {
            await finishBattleOnDisconnect(io, user.id);
          }

          removeUserSocket(user.id, socket.id);
        } catch (error) {
          console.error(error);
          removeUserSocket(user.id, socket.id);
        }
      });
    } catch (error) {
      console.error(error);

      socket.emit('battleError', {
        ok: false,
        error: 'Socket connection failed'
      });

      socket.disconnect(true);
    }
  });
}

module.exports = attachSocketHandlers;
