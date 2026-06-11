const config = {
  port: 3000,

  db: {
    host: 'localhost',
    user: 'great_user',
    password: 'great_pass_123',
    database: 'great_battle',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  session: {
    secret: 'great-battle-local-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
    }
  },

  ai: {
    useOpenAI: process.env.USE_OPENAI_AI === 'true',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    timeoutMs: 7000,
    maxReasonLength: 140
  }
};

module.exports = config;