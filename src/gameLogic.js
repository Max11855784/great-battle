const crypto = require('crypto');
const { pool } = require('./db');

const START_HP = 20;
const START_HAND_SIZE = 5;
const START_MANA = 10;
const MAX_MANA = 20;
const MAX_ACTIVE_CARDS = 3;
const TURN_DURATION_MS = 30000;

async function loadCards() {
  const [rows] = await pool.query(
    'SELECT id, alias, image, attack, defense, cost, faction FROM cards ORDER BY id'
  );

  return rows;
}

function formatFaction(faction) {
  return faction === 'hero' ? 'Heroes' : 'Villains';
}

function assignOppositeFactions() {
  if (Math.random() < 0.5) {
    return {
      player1Faction: 'hero',
      player2Faction: 'villain'
    };
  }

  return {
    player1Faction: 'villain',
    player2Faction: 'hero'
  };
}

function getCardsForFaction(allCards, faction) {
  const factionCards = allCards.filter(card => card.faction === faction);

  if (factionCards.length === 0) {
    throw new Error(`No cards found for faction: ${faction}`);
  }

  return factionCards;
}

function createCardInstance(card) {
  return {
    instanceId: crypto.randomUUID(),
    cardId: card.id,
    alias: card.alias,
    image: card.image,
    attack: card.attack,
    defense: card.defense,
    currentDefense: card.defense,
    cost: card.cost,
    faction: card.faction,
    playedThisTurn: false
  };
}

function returnCard(match, userId, instanceId) {
  if (match.status !== 'active') {
    return { ok: false, error: 'Battle is not active' };
  }

  if (match.currentTurnUserId !== Number(userId)) {
    return { ok: false, error: 'Not your turn' };
  }

  const player = getPlayerState(match, userId);

  if (!player) {
    return { ok: false, error: 'Player not found in battle' };
  }

  const cardIndex = player.activeCards.findIndex(c => c.instanceId === instanceId);
  if (cardIndex === -1) {
    return { ok: false, error: 'Card not found in active cards' };
  }

  const cardToReturn = player.activeCards[cardIndex];
  if (cardToReturn.currentDefense < cardToReturn.defense) {
    return { ok: false, error: 'Cannot return a damaged card' };
  }

  const [card] = player.activeCards.splice(cardIndex, 1);

  player.mana = Math.min(MAX_MANA, player.mana + card.cost);
  player.hand.push(card);
  match.logs.push(`${player.login} returned ${card.alias} to hand.`);
  return { ok: true };
}

function drawRandomCard(allCards, faction) {
  const cardPool = getCardsForFaction(allCards, faction);
  const randomIndex = Math.floor(Math.random() * cardPool.length);

  return createCardInstance(cardPool[randomIndex]);
}

function drawToFive(playerState, allCards) {
  let drawnCount = 0;

  while (playerState.hand.length < START_HAND_SIZE) {
    playerState.hand.push(drawRandomCard(allCards, playerState.faction));
    drawnCount++;
  }

  return drawnCount;
}

function createPlayerState(player, allCards, faction) {
  const state = {
    userId: Number(player.userId),
    login: player.login,
    avatar: player.avatar,
    socketId: player.socketId,
    isBot: Boolean(player.isBot),
    faction,
    hp: START_HP,
    mana: 0,
    hand: [],
    activeCards: []
  };

  drawToFive(state, allCards);

  return state;
}

async function createInitialBattleState(matchId, player1, player2) {
  const allCards = await loadCards();

  if (allCards.length === 0) {
    throw new Error('No cards found in database');
  }

  const factions = assignOppositeFactions();
  const firstPlayer = Math.random() < 0.5 ? player1 : player2;
  const now = Date.now();

  const state = {
    id: Number(matchId),
    status: 'active',
    isFirstTurn: true,
    winnerId: null,
    loserId: null,
    finishReason: null,
    turnTimer: null,
    allCards,
    player1: createPlayerState(player1, allCards, factions.player1Faction),
    player2: createPlayerState(player2, allCards, factions.player2Faction),
    currentTurnUserId: Number(firstPlayer.userId),
    turnStartedAt: now,
    turnEndsAt: now + TURN_DURATION_MS,
    logs: []
  };

  const currentPlayer = getPlayerState(state, firstPlayer.userId);
  currentPlayer.mana = Math.min(currentPlayer.mana + START_MANA, MAX_MANA);

  state.logs.push(
    `${state.player1.login} fights for ${formatFaction(state.player1.faction)}. ` +
    `${state.player2.login} fights for ${formatFaction(state.player2.faction)}.`
  );

  state.logs.push(`Battle started. ${currentPlayer.login} goes first.`);

  return state;
}

function getPlayerState(match, userId) {
  const numericUserId = Number(userId);

  if (match.player1.userId === numericUserId) {
    return match.player1;
  }

  if (match.player2.userId === numericUserId) {
    return match.player2;
  }

  return null;
}

function getOpponentState(match, userId) {
  const numericUserId = Number(userId);

  if (match.player1.userId === numericUserId) {
    return match.player2;
  }

  if (match.player2.userId === numericUserId) {
    return match.player1;
  }

  return null;
}

function playCard(match, userId, instanceId) {
  if (match.status !== 'active') {
    return { ok: false, error: 'Battle is not active' };
  }

  const player = getPlayerState(match, userId);

  if (!player) {
    return { ok: false, error: 'Player not found in battle' };
  }

  if (match.currentTurnUserId !== Number(userId)) {
    return { ok: false, error: 'It is not your turn' };
  }

  if (player.activeCards.length >= MAX_ACTIVE_CARDS) {
    return { ok: false, error: 'Active cards limit is 3' };
  }

  const cardIndex = player.hand.findIndex(card => card.instanceId === instanceId);

  if (cardIndex === -1) {
    return { ok: false, error: 'Card not found in hand' };
  }

  const card = player.hand[cardIndex];

  if (card.cost > player.mana) {
    return { ok: false, error: 'Not enough mana' };
  }

  player.hand.splice(cardIndex, 1);
  player.mana -= card.cost;
  card.playedThisTurn = true;
  player.activeCards.push(card);

  match.logs.push(`${player.login} played ${card.alias}.`);

  return { ok: true };
}

function applyDamageFromCard(match, attacker, opponent, attackerCard) {
  let damage = attackerCard.attack;

  match.logs.push(`${attacker.login}'s ${attackerCard.alias} attacks for ${damage}.`);

  while (damage > 0 && opponent.activeCards.length > 0) {
    const targetCard = opponent.activeCards[0];

    targetCard.currentDefense -= damage;

    if (targetCard.currentDefense <= 0) {
      const remainingDamage = -targetCard.currentDefense;

      opponent.activeCards.shift();

      match.logs.push(`${opponent.login}'s ${targetCard.alias} was destroyed.`);

      damage = remainingDamage;
    } else {
      match.logs.push(
        `${opponent.login}'s ${targetCard.alias} has ${targetCard.currentDefense} defense left.`
      );

      damage = 0;
    }
  }

  if (damage > 0 && !match.isFirstTurn) {
    const hpBefore = opponent.hp;

    opponent.hp = Math.max(0, opponent.hp - damage);

    const realDamage = hpBefore - opponent.hp;

    match.logs.push(
      `${opponent.login} received ${realDamage} HP damage. HP left: ${opponent.hp}/${START_HP}.`
    );
  }

  if (damage > 0 && match.isFirstTurn) {
    match.logs.push('First turn protection blocked HP damage.');
  }
}

function startNextTurn(match, nextPlayer) {
  const now = Date.now();

  match.currentTurnUserId = Number(nextPlayer.userId);
  match.turnStartedAt = now;
  match.turnEndsAt = now + TURN_DURATION_MS;
  match.isFirstTurn = false;

  nextPlayer.mana = Math.min(nextPlayer.mana + START_MANA, MAX_MANA);

  match.player1.activeCards.forEach(card => {
    card.playedThisTurn = false;
  });

  match.player2.activeCards.forEach(card => {
    card.playedThisTurn = false;
  });

  match.logs.push(`${nextPlayer.login}'s turn. Mana: ${nextPlayer.mana}/${MAX_MANA}.`);
}

async function finishBattle(match, winner, loser, finishReason) {
  if (match.status !== 'active') {
    return;
  }

  match.status = 'finished';
  match.winnerId = winner.userId;
  match.loserId = loser.userId;
  match.finishReason = finishReason;

  if (match.isAi) {
    return;
  }

  await pool.query(
    `UPDATE matches
     SET winner_id = ?,
         loser_id = ?,
         status = 'finished',
         finish_reason = ?,
         finish_time = NOW(),
         player1_end_hp = ?,
         player2_end_hp = ?
     WHERE id = ?`,
    [
      winner.userId,
      loser.userId,
      finishReason,
      match.player1.hp,
      match.player2.hp,
      match.id
    ]
  );

  if (match.logs.length > 0) {
    const values = match.logs.map(message => [
      match.id,
      null,
      message
    ]);

    await pool.query(
      'INSERT INTO match_logs (match_id, user_id, message) VALUES ?',
      [values]
    );
  }
}

async function attackAndEndTurn(match, userId, options = {}) {
  if (match.status !== 'active') {
    return { ok: false, error: 'Battle is not active' };
  }

  const player = getPlayerState(match, userId);
  const opponent = getOpponentState(match, userId);

  if (!player || !opponent) {
    return { ok: false, error: 'Player not found in battle' };
  }

  if (match.currentTurnUserId !== Number(userId)) {
    return { ok: false, error: 'It is not your turn' };
  }

  if (options.reason === 'timeout') {
    match.logs.push(`${player.login}'s turn timer expired.`);
  }

  match.logs.push(`${player.login} used Attack & End Turn.`);

  if (player.activeCards.length === 0) {
    match.logs.push(`${player.login} has no active cards to attack.`);
  }

  const attackingCards = [...player.activeCards];

  for (const attackerCard of attackingCards) {
    if (opponent.hp === 0) {
      break;
    }

    applyDamageFromCard(match, player, opponent, attackerCard);
  }

  const drawnCount = drawToFive(player, match.allCards);

  if (drawnCount > 0) {
    match.logs.push(`${player.login} drew ${drawnCount} card(s).`);
  }

  if (opponent.hp === 0) {
    match.logs.push(`${player.login} won the battle. ${opponent.login} lost all HP.`);

    await finishBattle(match, player, opponent, 'normal');

    return {
      ok: true,
      battleEnded: true,
      winnerId: player.userId,
      loserId: opponent.userId,
      finishReason: 'normal'
    };
  }

  match.logs.push(`${opponent.login} survived with ${opponent.hp}/${START_HP} HP.`);

  startNextTurn(match, opponent);

  return {
    ok: true,
    battleEnded: false
  };
}

async function finishBattleByDisconnect(match, disconnectedUserId) {
  if (!match || match.status !== 'active') {
    return { ok: false, error: 'Battle is not active' };
  }

  const loser = getPlayerState(match, disconnectedUserId);
  const winner = getOpponentState(match, disconnectedUserId);

  if (!winner || !loser) {
    return { ok: false, error: 'Player not found in battle' };
  }

  match.logs.push(`${loser.login} disconnected.`);
  match.logs.push(`${winner.login} won the battle by disconnect.`);

  await finishBattle(match, winner, loser, 'disconnect');

  return {
    ok: true,
    battleEnded: true,
    winnerId: winner.userId,
    loserId: loser.userId,
    finishReason: 'disconnect'
  };
}

async function giveUp(match, userId) {
  if (!match || match.status !== 'active') {
    return { ok: false, error: 'Battle is not active' };
  }

  const loser = getPlayerState(match, userId);
  const winner = getOpponentState(match, userId);

  if (!winner || !loser) {
    return { ok: false, error: 'Player not found in battle' };
  }

  match.logs.push(`${loser.login} gave up.`);
  match.logs.push(`${winner.login} won the battle by surrender.`);

  await finishBattle(match, winner, loser, 'surrender');

  return {
    ok: true,
    battleEnded: true,
    winnerId: winner.userId,
    loserId: loser.userId,
    finishReason: 'surrender'
  };
}

function buildBattleStateForUser(match, userId) {
  const me = getPlayerState(match, userId);
  const opponent = getOpponentState(match, userId);

  if (!me || !opponent) {
    return null;
  }

  const opponentIsActing = match.currentTurnUserId === opponent.userId;

  const opponentActiveCards = opponentIsActing
    ? opponent.activeCards.map(card => ({
      instanceId: card.instanceId,
      hidden: true
    }))
    : opponent.activeCards;

  return {
    matchId: match.id,
    currentTurnUserId: match.currentTurnUserId,
    turnEndsAt: match.turnEndsAt,
    maxMana: MAX_MANA,
    maxActiveCards: MAX_ACTIVE_CARDS,
    status: match.status,
    logs: match.logs,
    me: {
      userId: me.userId,
      login: me.login,
      avatar: me.avatar,
      isBot: me.isBot,
      faction: me.faction,
      hp: me.hp,
      mana: me.mana,
      hand: me.hand,
      activeCards: me.activeCards
    },
    opponent: {
      userId: opponent.userId,
      login: opponent.login,
      avatar: opponent.avatar,
      isBot: opponent.isBot,
      faction: opponent.faction,
      hp: opponent.hp,
      mana: opponent.mana,
      handCount: opponent.hand.length,
      activeCards: match.currentTurnUserId === opponent.userId
        ? opponent.activeCards.filter(card => !card.playedThisTurn)
        : opponent.activeCards
    }
  };
}

function buildBattleEndedPayload(match, userId) {
  const isWinner = Number(userId) === Number(match.winnerId);

  let message = isWinner ? 'You win!' : 'You lose!';

  if (match.finishReason === 'disconnect') {
    message = isWinner
      ? 'Opponent disconnected. You win!'
      : 'You disconnected. You lose!';
  }

  if (match.finishReason === 'surrender') {
    message = isWinner
      ? 'Opponent surrendered. You win!'
      : 'You surrendered. You lose!';
  }

  return {
    matchId: match.id,
    result: isWinner ? 'win' : 'lose',
    message,
    winnerId: match.winnerId,
    loserId: match.loserId,
    finishReason: match.finishReason
  };
}

module.exports = {
  START_HP,
  START_HAND_SIZE,
  START_MANA,
  MAX_MANA,
  MAX_ACTIVE_CARDS,
  TURN_DURATION_MS,
  createInitialBattleState,
  buildBattleStateForUser,
  buildBattleEndedPayload,
  drawToFive,
  getPlayerState,
  returnCard,
  getOpponentState,
  playCard,
  attackAndEndTurn,
  giveUp,
  finishBattleByDisconnect
};