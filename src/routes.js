const path = require('path');
const express = require('express');
const { pool } = require('./db');
const {
  hashPassword,
  verifyPassword,
  getUserById,
  getUserByLogin,
  requireAuth,
  requireGuest
} = require('./auth');
const { hasActiveMatch } = require('./gameState');
const { getProfileData } = require('./services/profileService');
const {
  getUserAvatarPathByCode,
  normalizeUserAvatarPath
} = require('./services/avatarService');

function createRoutes(projectRoot) {
  const router = express.Router();
  const publicDir = path.join(projectRoot, 'public');

  router.get('/', requireGuest, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  router.get('/login', requireGuest, (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
  });

  router.get('/register', requireGuest, (req, res) => {
    res.sendFile(path.join(publicDir, 'register.html'));
  });

  router.get('/lobby', requireAuth, (req, res) => {
    res.sendFile(path.join(publicDir, 'lobby.html'));
  });

  router.get('/battle', requireAuth, (req, res) => {
    if (!hasActiveMatch(req.session.userId)) {
      res.redirect('/lobby');
      return;
    }

    res.sendFile(path.join(publicDir, 'battle.html'));
  });

  router.get('/cards', requireAuth, (req, res) => {
    res.sendFile(path.join(publicDir, 'cards.html'));
  });

  router.get('/profile', requireAuth, (req, res) => {
    res.sendFile(path.join(publicDir, 'profile.html'));
  });

  router.get('/rating', requireAuth, (req, res) => {
    res.sendFile(path.join(publicDir, 'rating.html'));
  });

  router.post('/api/register', async (req, res) => {
    try {
      const login = String(req.body.login || '').trim();
      const password = String(req.body.password || '');
      const avatarCode = String(req.body.avatarCode || '').trim();
      const rawAvatar = String(req.body.avatar || '').trim();

      const avatar = getUserAvatarPathByCode(avatarCode) || normalizeUserAvatarPath(rawAvatar);

      if (login.length < 3 || login.length > 50) {
        res.status(400).json({
          ok: false,
          error: 'Login must be from 3 to 50 characters'
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          ok: false,
          error: 'Password must be at least 6 characters'
        });
        return;
      }

      if (!avatar) {
        res.status(400).json({
          ok: false,
          error: 'Invalid avatar'
        });
        return;
      }

      const passwordHash = await hashPassword(password);

      const [result] = await pool.query(
        'INSERT INTO users (login, password_hash, avatar) VALUES (?, ?, ?)',
        [login, passwordHash, avatar]
      );

      req.session.userId = result.insertId;

      res.json({
        ok: true,
        data: {
          redirect: '/lobby'
        }
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          ok: false,
          error: 'Login already exists'
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        ok: false,
        error: 'Registration failed'
      });
    }
  });

  router.post('/api/login', async (req, res) => {
    try {
      const login = String(req.body.login || '').trim();
      const password = String(req.body.password || '');

      if (!login || !password) {
        res.status(400).json({
          ok: false,
          error: 'Login and password are required'
        });
        return;
      }

      const user = await getUserByLogin(login);

      if (!user) {
        res.status(401).json({
          ok: false,
          error: 'Invalid login or password'
        });
        return;
      }

      const passwordOk = await verifyPassword(password, user.password_hash);

      if (!passwordOk) {
        res.status(401).json({
          ok: false,
          error: 'Invalid login or password'
        });
        return;
      }

      req.session.userId = user.id;

      res.json({
        ok: true,
        data: {
          redirect: '/lobby'
        }
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: 'Login failed'
      });
    }
  });

  router.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');

      res.json({
        ok: true,
        data: {
          redirect: '/'
        }
      });
    });
  });

  router.get('/api/me', async (req, res) => {
    try {
      if (!req.session.userId) {
        res.status(401).json({
          ok: false,
          error: 'Not authenticated'
        });
        return;
      }

      const user = await getUserById(req.session.userId);

      if (!user) {
        req.session.destroy(() => { });

        res.status(401).json({
          ok: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        ok: true,
        data: {
          user
        }
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: 'Failed to load user'
      });
    }
  });

  router.get('/api/cards', async (req, res) => {
    try {
      if (!req.session.userId) {
        res.status(401).json({
          ok: false,
          error: 'Not authenticated'
        });
        return;
      }

      const [cards] = await pool.query(
        `SELECT id, alias, image, attack, defense, cost, faction
         FROM cards
         ORDER BY cost, alias`
      );

      res.json({
        ok: true,
        data: {
          cards
        }
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: 'Failed to load cards'
      });
    }
  });

  router.get('/api/profile', async (req, res) => {
    try {
      if (!req.session.userId) {
        res.status(401).json({
          ok: false,
          error: 'Not authenticated'
        });
        return;
      }

      const user = await getUserById(req.session.userId);

      if (!user) {
        req.session.destroy(() => { });

        res.status(401).json({
          ok: false,
          error: 'User not found'
        });
        return;
      }

      const profileData = await getProfileData(user);

      res.json({
        ok: true,
        data: profileData
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: 'Failed to load profile'
      });
    }
  });

  router.get('/api/rating', async (req, res) => {
    try {
      if (!req.session.userId) {
        res.status(401).json({
          ok: false,
          error: 'Not authenticated'
        });
        return;
      }

      const [players] = await pool.query(
        `SELECT
         users.id,
         users.login,
         users.avatar,
         COUNT(matches.id) AS wins
       FROM users
       LEFT JOIN matches
         ON matches.winner_id = users.id
        AND matches.status = 'finished'
       GROUP BY users.id, users.login, users.avatar
       ORDER BY wins DESC, users.login ASC`
      );

      res.json({
        ok: true,
        data: {
          currentUserId: req.session.userId,
          players: players.map(player => ({
            id: player.id,
            login: player.login,
            avatar: player.avatar,
            wins: Number(player.wins || 0)
          }))
        }
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: 'Failed to load rating'
      });
    }
  });

  return router;
}

module.exports = createRoutes;
