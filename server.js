const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');

const config = require('./src/config');
const { testConnection } = require('./src/db');
const createRoutes = require('./src/routes');
const attachSocketHandlers = require('./src/socketHandlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session(config.session);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

io.engine.use(sessionMiddleware);

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await testConnection();

    res.json({
      ok: true,
      data: {
        app: 'Great Battle',
        server: 'running',
        database: dbResult.ok === 1 ? 'connected' : 'unknown'
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Database connection failed'
    });
  }
});

app.use(createRoutes(__dirname));

attachSocketHandlers(io);

server.listen(config.port, () => {
  console.log(`Great Battle server started on http://localhost:${config.port}`);
});
