const { pool } = require('../db');
const { buildAchievements } = require('./achievementService');

function getOpponentId(match, userId) {
  if (Number(match.player1_id) === Number(userId)) {
    return Number(match.player2_id);
  }

  return Number(match.player1_id);
}

function getMatchDay(match) {
  if (!match.finish_time) {
    return 'unknown';
  }

  return new Date(match.finish_time).toISOString().slice(0, 10);
}

function calculateHistoryMetrics(matches, userId) {
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let revengeWins = 0;

  const lostToOpponents = new Set();
  const winsByOpponent = new Map();
  const battlesByDay = new Map();

  matches.forEach((match) => {
    const isWin = Number(match.winner_id) === Number(userId);
    const opponentId = getOpponentId(match, userId);
    const day = getMatchDay(match);

    battlesByDay.set(day, (battlesByDay.get(day) || 0) + 1);

    if (isWin) {
      currentWinStreak++;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);

      winsByOpponent.set(
        opponentId,
        (winsByOpponent.get(opponentId) || 0) + 1
      );

      if (lostToOpponents.has(opponentId)) {
        revengeWins++;
      }
    } else {
      currentWinStreak = 0;
      lostToOpponents.add(opponentId);
    }
  });

  const maxWinsVsSameOpponent = winsByOpponent.size > 0
    ? Math.max(...winsByOpponent.values())
    : 0;

  const maxBattlesInOneDay = battlesByDay.size > 0
    ? Math.max(...battlesByDay.values())
    : 0;

  return {
    maxWinStreak,
    maxWinsVsSameOpponent,
    revengeWins,
    maxBattlesInOneDay
  };
}

async function getProfileStats(userId) {
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN loser_id = ? THEN 1 ELSE 0 END) AS losses,
       COUNT(*) AS total_battles
     FROM matches
     WHERE status = 'finished'
       AND (player1_id = ? OR player2_id = ?)`,
    [userId, userId, userId, userId]
  );

  const stats = rows[0] || {};

  return {
    wins: Number(stats.wins || 0),
    losses: Number(stats.losses || 0),
    totalBattles: Number(stats.total_battles || 0)
  };
}

async function getWinTypeMetrics(userId) {
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN finish_reason = 'normal' THEN 1 ELSE 0 END) AS normal_wins,
       SUM(CASE WHEN finish_reason = 'disconnect' THEN 1 ELSE 0 END) AS disconnect_wins,

       SUM(
         CASE
           WHEN finish_reason = 'normal'
            AND player1_id = ?
            AND player1_end_hp BETWEEN 1 AND 5 THEN 1
           WHEN finish_reason = 'normal'
            AND player2_id = ?
            AND player2_end_hp BETWEEN 1 AND 5 THEN 1
           ELSE 0
         END
       ) AS survivor_wins,

       SUM(
         CASE
           WHEN finish_reason = 'normal'
            AND player1_id = ?
            AND player1_end_hp = 20 THEN 1
           WHEN finish_reason = 'normal'
            AND player2_id = ?
            AND player2_end_hp = 20 THEN 1
           ELSE 0
         END
       ) AS perfect_wins,

       SUM(
         CASE
           WHEN finish_reason = 'normal'
            AND TIMESTAMPDIFF(SECOND, start_time, finish_time) < 120 THEN 1
           ELSE 0
         END
       ) AS quick_victory_wins,

       SUM(
         CASE
           WHEN finish_reason = 'normal'
            AND TIMESTAMPDIFF(SECOND, start_time, finish_time) >= 300 THEN 1
           ELSE 0
         END
       ) AS long_duel_wins
     FROM matches
     WHERE status = 'finished'
       AND winner_id = ?`,
    [userId, userId, userId, userId, userId]
  );

  const metrics = rows[0] || {};

  return {
    normalWins: Number(metrics.normal_wins || 0),
    disconnectWins: Number(metrics.disconnect_wins || 0),
    survivorWins: Number(metrics.survivor_wins || 0),
    perfectWins: Number(metrics.perfect_wins || 0),
    quickVictoryWins: Number(metrics.quick_victory_wins || 0),
    longDuelWins: Number(metrics.long_duel_wins || 0)
  };
}

async function getFinishedMatchesForUser(userId) {
  const [matches] = await pool.query(
    `SELECT
       id,
       player1_id,
       player2_id,
       winner_id,
       loser_id,
       status,
       finish_reason,
       start_time,
       finish_time,
       player1_end_hp,
       player2_end_hp
     FROM matches
     WHERE status = 'finished'
       AND (player1_id = ? OR player2_id = ?)
     ORDER BY finish_time ASC, id ASC`,
    [userId, userId]
  );

  return matches;
}

async function getProfileData(user) {
  const stats = await getProfileStats(user.id);
  const winTypeMetrics = await getWinTypeMetrics(user.id);
  const finishedMatches = await getFinishedMatchesForUser(user.id);
  const historyMetrics = calculateHistoryMetrics(finishedMatches, user.id);

  const achievements = buildAchievements({
    ...stats,
    ...winTypeMetrics,
    ...historyMetrics
  });

  return {
    user,
    stats,
    achievements
  };
}

module.exports = {
  getProfileData
};