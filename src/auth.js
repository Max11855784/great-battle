const crypto = require('crypto');
const { pool } = require('./db');

const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');

    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = storedHash.split(':');

    if (!salt || !key) {
      resolve(false);
      return;
    }

    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      const storedKey = Buffer.from(key, 'hex');

      if (storedKey.length !== derivedKey.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(storedKey, derivedKey));
    });
  });
}

async function getUserById(userId) {
  const [rows] = await pool.query(
    'SELECT id, login, avatar, created_at FROM users WHERE id = ?',
    [userId]
  );

  return rows[0] || null;
}

async function getUserByLogin(login) {
  const [rows] = await pool.query(
    'SELECT id, login, password_hash, avatar, created_at FROM users WHERE login = ?',
    [login]
  );

  return rows[0] || null;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    res.redirect('/login');
    return;
  }

  next();
}

function requireGuest(req, res, next) {
  if (req.session.userId) {
    res.redirect('/lobby');
    return;
  }

  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  getUserById,
  getUserByLogin,
  requireAuth,
  requireGuest
};
