const config = require('../config');
const {
  getPlayerState,
  getOpponentState,
  MAX_ACTIVE_CARDS,
  MAX_MANA
} = require('../gameLogic');

let openAiClient = null;

function getOpenAiClient() {
  if (!config.ai || !config.ai.useOpenAI) {
    return null;
  }

  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (openAiClient) {
    return openAiClient;
  }

  const OpenAIModule = require('openai');
  const OpenAI = OpenAIModule.default || OpenAIModule;

  openAiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: config.ai.timeoutMs || 7000
  });

  return openAiClient;
}

function cardToPublicView(card, index = null) {
  const result = {
    alias: card.alias,
    attack: card.attack,
    defense: card.defense,
    currentDefense: card.currentDefense,
    cost: card.cost,
    faction: card.faction
  };

  if (index !== null) {
    result.handIndex = index;
  }

  return result;
}

function buildSanitizedBattleState(match) {
  const bot = getPlayerState(match, match.currentTurnUserId);
  const opponent = getOpponentState(match, bot.userId);

  return {
    ai: {
      hp: bot.hp,
      mana: bot.mana,
      faction: bot.faction,
      activeSlotsUsed: bot.activeCards.length,
      activeSlotsFree: Math.max(0, MAX_ACTIVE_CARDS - bot.activeCards.length),
      hand: bot.hand.map((card, index) => cardToPublicView(card, index)),
      activeCards: bot.activeCards.map(card => cardToPublicView(card))
    },
    opponent: {
      hp: opponent.hp,
      mana: opponent.mana,
      faction: opponent.faction,
      handCount: opponent.hand.length,
      activeCards: opponent.activeCards.map(card => cardToPublicView(card))
    },
    rules: {
      maxMana: MAX_MANA,
      maxActiveCards: MAX_ACTIVE_CARDS,
      goal: 'Reduce opponent HP to 0.',
      playRule: 'You may play cards only from your hand if cost is less than or equal to current mana and active slots are available.',
      attackRule: 'After playing cards, all active cards attack oldest enemy active card first, then newer cards, then opponent HP.',
      hiddenInfoRule: 'You cannot see opponent hand cards. You only know opponent hand count.'
    }
  };
}

function getDecisionSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['cardsToPlay', 'reason'],
    properties: {
      cardsToPlay: {
        type: 'array',
        description: 'Array of handIndex numbers for cards the AI wants to play before ending the turn.',
        items: {
          type: 'integer'
        }
      },
      reason: {
        type: 'string',
        description: 'Short explanation of the selected move.'
      }
    }
  };
}

function normalizeDecision(rawDecision, handLength) {
  if (!rawDecision || !Array.isArray(rawDecision.cardsToPlay)) {
    return null;
  }

  const seen = new Set();
  const cardsToPlay = [];

  rawDecision.cardsToPlay.forEach((value) => {
    const index = Number(value);

    if (!Number.isInteger(index)) {
      return;
    }

    if (index < 0 || index >= handLength) {
      return;
    }

    if (seen.has(index)) {
      return;
    }

    seen.add(index);
    cardsToPlay.push(index);
  });

  const reason = String(rawDecision.reason || 'AI selected a move.').trim();

  return {
    cardsToPlay,
    reason
  };
}

function trimReason(reason) {
  const maxLength = config.ai && config.ai.maxReasonLength
    ? config.ai.maxReasonLength
    : 140;

  if (reason.length <= maxLength) {
    return reason;
  }

  return `${reason.slice(0, maxLength)}...`;
}

async function getOpenAiDecision(match) {
  try {
    const client = getOpenAiClient();

    if (!client) {
      return null;
    }

    const bot = getPlayerState(match, match.currentTurnUserId);

    if (!bot || !bot.isBot) {
      return null;
    }

    const battleState = buildSanitizedBattleState(match);

    const response = await client.responses.create({
      model: config.ai.model || 'gpt-4o-mini',
      instructions:
        'You are an AI opponent in a turn-based Marvel card battle game. ' +
        'Choose which cards to play this turn. ' +
        'Return only a legal move according to the provided rules. ' +
        'Prefer strong board presence, efficient mana use, and reducing opponent HP.',
      input: JSON.stringify(battleState),
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_battle_decision',
          strict: true,
          schema: getDecisionSchema()
        }
      }
    });

    const outputText = response.output_text;

    if (!outputText) {
      return null;
    }

    const parsed = JSON.parse(outputText);
    const decision = normalizeDecision(parsed, bot.hand.length);

    if (!decision) {
      return null;
    }

    return {
      cardsToPlay: decision.cardsToPlay,
      reason: trimReason(decision.reason)
    };
  } catch (error) {
    console.error('OpenAI AI decision failed:', error.message);
    return null;
  }
}

module.exports = {
  getOpenAiDecision
};
