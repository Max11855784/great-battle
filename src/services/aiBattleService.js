const { createActiveMatch } = require('../gameState');
const {
  createInitialBattleState,
  getPlayerState,
  playCard,
  attackAndEndTurn,
  MAX_ACTIVE_CARDS
} = require('../gameLogic');

const { getOpenAiDecision } = require('./aiDecisionService');
const { AI_BOT_AVATAR } = require('./avatarService');

let nextAiMatchId = -1;

function createAiMatchId() {
  const id = nextAiMatchId;
  nextAiMatchId -= 1;
  return id;
}

function makeHumanPlayer(user, socketId) {
  return {
    userId: Number(user.id),
    login: user.login,
    avatar: user.avatar,
    socketId,
    isBot: false
  };
}

function makeAiPlayer(matchId) {
  return {
    userId: matchId * 1000,
    login: 'AI Opponent',
    avatar: AI_BOT_AVATAR,
    socketId: null,
    isBot: true
  };
}

function isBotTurn(match) {
  if (!match || match.status !== 'active') {
    return false;
  }

  const currentPlayer = getPlayerState(match, match.currentTurnUserId);

  return Boolean(currentPlayer && currentPlayer.isBot);
}

async function createAiBattle(user, socketId) {
  const matchId = createAiMatchId();

  const humanPlayer = makeHumanPlayer(user, socketId);
  const aiPlayer = makeAiPlayer(matchId);

  const match = await createInitialBattleState(matchId, humanPlayer, aiPlayer);

  match.isAi = true;
  match.botThinking = false;
  match.logs.push('Practice vs AI mode. This battle is not saved to rating.');

  createActiveMatch(match);

  return match;
}

async function performSimpleFallbackBotTurn(match) {
  const bot = getPlayerState(match, match.currentTurnUserId);

  if (!bot || !bot.isBot) {
    return {
      ok: false,
      error: 'Current player is not AI'
    };
  }

  match.logs.push(`${bot.login} uses fallback strategy.`);

  while (bot.activeCards.length < MAX_ACTIVE_CARDS) {
    const playableCards = bot.hand
      .filter(card => card.cost <= bot.mana)
      .sort((a, b) => {
        if (b.cost !== a.cost) {
          return b.cost - a.cost;
        }

        if (b.attack !== a.attack) {
          return b.attack - a.attack;
        }

        return b.defense - a.defense;
      });

    if (playableCards.length === 0) {
      break;
    }

    const cardToPlay = playableCards[0];
    const result = playCard(match, bot.userId, cardToPlay.instanceId);

    if (!result.ok) {
      break;
    }
  }

  return attackAndEndTurn(match, bot.userId, {
    reason: 'ai'
  });
}

async function performFallbackBotTurn(match) {
  const bot = getPlayerState(match, match.currentTurnUserId);

  if (!bot || !bot.isBot) {
    return {
      ok: false,
      error: 'Current player is not AI'
    };
  }

  const decision = await getOpenAiDecision(match);

  if (!decision) {
    match.logs.push('AI service unavailable. Fallback strategy used.');
    return performSimpleFallbackBotTurn(match);
  }

  match.logs.push(`AI strategy: ${decision.reason}`);

  const instanceIdsToPlay = decision.cardsToPlay
    .map(index => bot.hand[index])
    .filter(Boolean)
    .map(card => card.instanceId);

  for (const instanceId of instanceIdsToPlay) {
    if (bot.activeCards.length >= MAX_ACTIVE_CARDS) {
      break;
    }

    const result = playCard(match, bot.userId, instanceId);

    if (!result.ok) {
      match.logs.push('AI selected an invalid card. Server ignored it.');
    }
  }

  return attackAndEndTurn(match, bot.userId, {
    reason: 'ai'
  });
}

module.exports = {
  createAiBattle,
  isBotTurn,
  performFallbackBotTurn
};
