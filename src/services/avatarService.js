const USER_AVATARS = Object.freeze({
  men: '/images/avatars/avatar_men.png',
  women: '/images/avatars/avatar_women.png',
  gasmask: '/images/avatars/avatar_gasmask.png',
  helmet: '/images/avatars/avatar_helmet.png',
  mystic: '/images/avatars/avatar_mystic.png',
  glasses: '/images/avatars/avatar_glasses.png'
});

const DEFAULT_USER_AVATAR = USER_AVATARS.men;
const AI_BOT_AVATAR = '/images/avatars/avatar_ai.jpg';

function getUserAvatarPathByCode(code) {
  const key = String(code || '').trim();

  return USER_AVATARS[key] || null;
}

function normalizeUserAvatarPath(path) {
  const value = String(path || '').trim();
  const allowedPaths = Object.values(USER_AVATARS);

  if (allowedPaths.includes(value)) {
    return value;
  }

  return null;
}

function getDefaultUserAvatar() {
  return DEFAULT_USER_AVATAR;
}

module.exports = {
  USER_AVATARS,
  DEFAULT_USER_AVATAR,
  AI_BOT_AVATAR,
  getUserAvatarPathByCode,
  normalizeUserAvatarPath,
  getDefaultUserAvatar
};
