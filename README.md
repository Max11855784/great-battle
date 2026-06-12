# Great Battle

**Great Battle** is a full-stack turn-based Marvel card battle game created for the Race 01 Half Marathon Full Stack challenge.

The game allows registered users to log in, find an opponent, and fight in a real-time online card battle. Each player has health points, mana, a hand of cards, active cards on the battlefield, and a limited time for each turn.

---

## Features

* User registration and login
* Session-based authentication
* Protected private pages
* Automatic PvP matchmaking through WebSocket
* Practice vs AI mode
* Turn-based battle system
* 30-second turn timer
* Player avatars and nicknames
* Hero and villain factions
* Random faction assignment in battle
* Random first player selection
* Card hand system
* Mana system
* Active card battlefield
* Automatic attacks at the end of the turn
* Battle log
* Victory and defeat modal windows
* Cards library with filters
* Player profile with statistics
* Simple rating system based on wins
* Achievement system
* MySQL storage for users, cards, matches, logs, and results

---

## Technology Stack

* HTML
* CSS
* JavaScript
* Node.js
* Express
* Express-session
* Socket.IO
* MySQL
* mysql2
* OpenAI API support for AI mode
* Fallback AI bot when OpenAI is unavailable

---

## Requirements

Before running the project, install:

* Node.js 20+
* MySQL Server 8+
* Git Bash, PowerShell, or another terminal

---

## Project Structure

```text
great-battle/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── images/
│   │   ├── avatars/
│   │   └── cards/
│   ├── js/
│   │   ├── battle.js
│   │   ├── cards.js
│   │   ├── lobby.js
│   │   ├── login.js
│   │   ├── profile.js
│   │   ├── rating.js
│   │   └── register.js
│   ├── battle.html
│   ├── cards.html
│   ├── index.html
│   ├── lobby.html
│   ├── login.html
│   ├── profile.html
│   ├── rating.html
│   └── register.html
├── src/
│   ├── services/
│   │   ├── achievementService.js
│   │   ├── aiBattleService.js
│   │   ├── aiDecisionService.js
│   │   ├── avatarService.js
│   │   └── profileService.js
│   ├── auth.js
│   ├── config.js
│   ├── db.js
│   ├── gameLogic.js
│   ├── gameState.js
│   ├── matchmaking.js
│   ├── routes.js
│   └── socketHandlers.js
├── .env.example
├── .gitignore
├── db.sql
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/Max11855784/great-battle.git
```

Open the project folder:

```bash
cd great-battle
```

Install dependencies:

```bash
npm install
```

---

## Environment Configuration

The repository contains an `.env.example` file with example local settings:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=great_battle
```

You can create a local `.env` file based on `.env.example` and adjust the values for your MySQL configuration.

Do not commit real API keys, passwords, or private environment files to the repository.

---

## Database Setup

The project uses a MySQL database named:

```text
great_battle
```

Main tables:

```text
users
cards
matches
match_logs
```

Import the database from `db.sql`.

### Option 1: Import using root

```bash
mysql -u root -p < db.sql
```

Then enter your MySQL root password.

### Option 2: Import using a project user

If the database and user already exist:

```bash
mysql -u great_user -p great_battle < db.sql
```

### Create a MySQL project user

If the project user does not exist, create it in MySQL:

```sql
CREATE USER IF NOT EXISTS 'great_user'@'localhost'
IDENTIFIED BY 'great_pass_123';

GRANT ALL PRIVILEGES ON great_battle.* TO 'great_user'@'localhost';

FLUSH PRIVILEGES;
```

Example local database configuration:

```text
user: great_user
password: great_pass_123
database: great_battle
```

### Check the database

Open MySQL console or MySQL Workbench and run:

```sql
USE great_battle;

SHOW TABLES;

SELECT COUNT(*) AS cards_count FROM cards;

SELECT faction, COUNT(*) AS cards_count
FROM cards
GROUP BY faction;
```

Expected tables:

```text
users
cards
matches
match_logs
```

Cards should be present in both factions:

```text
hero
villain
```

---

## Run the Project

Start the server:

```bash
npm start
```

Open the application in the browser:

```text
http://localhost:3000
```

---

## Run Without OpenAI

This mode uses the built-in fallback AI bot.

### Git Bash

```bash
unset OPENAI_API_KEY
unset USE_OPENAI_AI
npm start
```

### PowerShell

```powershell
Remove-Item Env:OPENAI_API_KEY
Remove-Item Env:USE_OPENAI_AI
npm start
```

The game will still support Practice vs AI mode through the fallback bot.

---

## Run With OpenAI AI Opponent

OpenAI is used only in Practice vs AI mode.

Do not write your OpenAI API key into the source code.

### Git Bash

```bash
export OPENAI_API_KEY="your_openai_api_key_here"
export USE_OPENAI_AI="true"
npm start
```

### PowerShell

```powershell
$env:OPENAI_API_KEY="your_openai_api_key_here"
$env:USE_OPENAI_AI="true"
npm start
```

Optional model setting:

### Git Bash

```bash
export OPENAI_MODEL="gpt-4o-mini"
```

### PowerShell

```powershell
$env:OPENAI_MODEL="gpt-4o-mini"
```

If OpenAI is unavailable, the project automatically uses the fallback AI strategy.

---

## Game Rules

* Each player starts with 20 HP.
* Each player has 5 cards in hand.
* Cards are randomly drawn from the player’s assigned faction.
* One player receives the hero faction and the other receives the villain faction.
* The first player is selected randomly.
* Each turn is limited to 30 seconds.
* The player receives mana at the start of their turn.
* Mana is required to play cards.
* A player can have up to 3 active cards on the battlefield.
* The player can play several cards during their turn if they have enough mana.
* Active cards attack when the player presses **Attack & End Turn** or when the timer expires.
* Damage is applied to the oldest enemy active card first.
* Remaining damage goes to the next enemy card or directly to the opponent’s HP.
* When a player’s HP reaches 0, that player loses.
* If a player disconnects or refreshes the page during an active PvP battle, the opponent wins.
* Practice vs AI battles do not affect rating or profile statistics.

---

## Main Pages

| Route       | Description       |
| ----------- | ----------------- |
| `/`         | Main page         |
| `/register` | Registration page |
| `/login`    | Login page        |
| `/lobby`    | Player lobby      |
| `/battle`   | Battle page       |
| `/cards`    | Cards library     |
| `/profile`  | Player profile    |
| `/rating`   | Player rating     |

---

## API Routes

| Method | Route           | Description           |
| ------ | --------------- | --------------------- |
| GET    | `/api/health`   | Health check          |
| POST   | `/api/register` | Register a new user   |
| POST   | `/api/login`    | Log in a user         |
| POST   | `/api/logout`   | Log out current user  |
| GET    | `/api/me`       | Get current user data |
| GET    | `/api/cards`    | Get cards list        |
| GET    | `/api/profile`  | Get player profile    |
| GET    | `/api/rating`   | Get player rating     |

---

## WebSocket Events

Main client-server events:

```text
socketReady
findBattle
cancelFindBattle
startAiBattle
battleStarted
getBattleState
battleState
playCard
returnCard
endTurn
giveUp
battleEnded
battleError
authError
```

---

## Educational Purpose

This project was created to practice:

* Full-stack JavaScript development
* REST API development
* WebSocket communication
* Session-based authentication
* MySQL database integration
* Real-time game state synchronization
* Modular backend structure
* Game logic implementation
* Basic AI opponent logic
