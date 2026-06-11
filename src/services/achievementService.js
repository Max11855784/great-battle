const ACHIEVEMENT_DEFINITIONS = [
  {
    code: 'first_victory',
    title: 'First Victory',
    description: 'Win your first battle.',
    icon: '🏆',
    metric: 'wins',
    target: 1
  },
  {
    code: 'rising_fighter',
    title: 'Rising Fighter',
    description: 'Win 5 battles.',
    icon: '⚔️',
    metric: 'wins',
    target: 5
  },
  {
    code: 'champion',
    title: 'Champion',
    description: 'Win 10 battles.',
    icon: '👑',
    metric: 'wins',
    target: 10
  },
  {
    code: 'battle_tested',
    title: 'Battle Tested',
    description: 'Play 5 finished battles.',
    icon: '🎮',
    metric: 'totalBattles',
    target: 5
  },
  {
    code: 'veteran',
    title: 'Veteran',
    description: 'Play 10 finished battles.',
    icon: '🛡️',
    metric: 'totalBattles',
    target: 10
  },
  {
    code: 'survivor',
    title: 'Survivor',
    description: 'Win a normal battle with 5 HP or less.',
    icon: '💀',
    metric: 'survivorWins',
    target: 1
  },
  {
    code: 'perfect_victory',
    title: 'Perfect Victory',
    description: 'Win a normal battle with full HP.',
    icon: '✨',
    metric: 'perfectWins',
    target: 1
  },
  {
    code: 'win_streak',
    title: 'Win Streak',
    description: 'Win 3 battles in a row.',
    icon: '🔥',
    metric: 'maxWinStreak',
    target: 3
  },
  {
    code: 'unstoppable',
    title: 'Unstoppable',
    description: 'Win 5 battles in a row.',
    icon: '🚀',
    metric: 'maxWinStreak',
    target: 5
  },
  {
    code: 'clutch_master',
    title: 'Clutch Master',
    description: 'Win 3 normal battles with 5 HP or less.',
    icon: '🩸',
    metric: 'survivorWins',
    target: 3
  },
  {
    code: 'untouched',
    title: 'Untouched',
    description: 'Win 3 normal battles with full HP.',
    icon: '🌟',
    metric: 'perfectWins',
    target: 3
  },
  {
    code: 'normal_fighter',
    title: 'Normal Fighter',
    description: 'Win 5 battles without opponent disconnecting.',
    icon: '⚡',
    metric: 'normalWins',
    target: 5
  },
  {
    code: 'punisher',
    title: 'Punisher',
    description: 'Win 3 battles because the opponent disconnected.',
    icon: '☠️',
    metric: 'disconnectWins',
    target: 3
  },
  {
    code: 'rival_crusher',
    title: 'Rival Crusher',
    description: 'Defeat the same opponent 3 times.',
    icon: '🥊',
    metric: 'maxWinsVsSameOpponent',
    target: 3
  },
  {
    code: 'revenge',
    title: 'Revenge',
    description: 'Defeat a player who defeated you before.',
    icon: '🔁',
    metric: 'revengeWins',
    target: 1
  },
  {
    code: 'daily_warrior',
    title: 'Daily Warrior',
    description: 'Play 3 finished battles in one day.',
    icon: '📅',
    metric: 'maxBattlesInOneDay',
    target: 3
  },
  {
    code: 'quick_victory',
    title: 'Quick Victory',
    description: 'Win a normal battle in less than 2 minutes.',
    icon: '⏱️',
    metric: 'quickVictoryWins',
    target: 1
  },
  {
    code: 'long_duel',
    title: 'Long Duel',
    description: 'Win a normal battle that lasted 5 minutes or more.',
    icon: '⌛',
    metric: 'longDuelWins',
    target: 1
  }
];

function buildAchievement(definition, metrics) {
  const rawProgress = Number(metrics[definition.metric] || 0);
  const progress = Math.min(rawProgress, definition.target);

  return {
    code: definition.code,
    title: definition.title,
    description: definition.description,
    icon: definition.icon,
    unlocked: rawProgress >= definition.target,
    progress,
    target: definition.target
  };
}

function buildAchievements(metrics) {
  return ACHIEVEMENT_DEFINITIONS.map(definition =>
    buildAchievement(definition, metrics)
  );
}

module.exports = {
  buildAchievements
};