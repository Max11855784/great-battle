CREATE DATABASE IF NOT EXISTS great_battle
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE great_battle;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alias VARCHAR(80) NOT NULL UNIQUE,
  image VARCHAR(255) NOT NULL,
  attack INT NOT NULL,
  defense INT NOT NULL,
  cost INT NOT NULL,
  faction ENUM('hero', 'villain') NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player1_id INT NOT NULL,
  player2_id INT NOT NULL,
  winner_id INT NULL,
  loser_id INT NULL,
  status ENUM('active', 'finished') NOT NULL DEFAULT 'active',
  finish_reason ENUM('normal', 'disconnect', 'surrender') NULL,
  start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finish_time DATETIME NULL,
  player1_end_hp INT NULL,
  player2_end_hp INT NULL,

  CONSTRAINT fk_matches_player1
    FOREIGN KEY (player1_id) REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_matches_player2
    FOREIGN KEY (player2_id) REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_matches_winner
    FOREIGN KEY (winner_id) REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_matches_loser
    FOREIGN KEY (loser_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  user_id INT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_match_logs_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_match_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

INSERT INTO cards (alias, image, attack, defense, cost, faction) VALUES
('Hawkeye', '/images/cards/hawkeye.webp', 2, 1, 1, 'hero'),
('Black Widow', '/images/cards/black-widow.webp', 1, 2, 1, 'hero'),
('Falcon', '/images/cards/falcon.webp', 2, 2, 2, 'hero'),
('Ant-Man', '/images/cards/ant_man.webp', 1, 3, 2, 'hero'),
('Winter Soldier', '/images/cards/winter-soldier.webp', 3, 1, 2, 'hero'),
('Captain America', '/images/cards/captain_america.webp', 3, 4, 3, 'hero'),
('Spider-Man', '/images/cards/spider-man.png', 4, 3, 3, 'hero'),
('Black Panther', '/images/cards/black-panther.webp', 5, 2, 3, 'hero'),
('Iron Man', '/images/cards/iron-man.png', 4, 5, 4, 'hero'),
('Thor', '/images/cards/thor.png', 6, 3, 4, 'hero'),
('Wolverine', '/images/cards/wolverine.webp', 5, 4, 4, 'hero'),
('Hulk', '/images/cards/hulk.webp', 7, 5, 5, 'hero'),
('Doctor Strange', '/images/cards/doctor-strange.webp', 5, 7, 5, 'hero'),
('Scarlet Witch', '/images/cards/scarlet-witch.webp', 6, 6, 5, 'hero'),
('Captain Marvel', '/images/cards/captain-marvel.webp', 8, 5, 6, 'hero'),
('Vision', '/images/cards/vision.webp', 6, 8, 6, 'hero'),
('Odin', '/images/cards/odin.webp', 8, 9, 7, 'hero'),
('Jean Grey', '/images/cards/jean-grey.png', 10, 6, 8, 'hero'),
('Thanos', '/images/cards/thanos.png', 9, 8, 7, 'villain'),
('Galactus', '/images/cards/galactus.webp', 10, 10, 8, 'villain'),
('Green Goblin', '/images/cards/green_goblin.webp', 5, 2, 3, 'villain'),
('Doctor Octopus', '/images/cards/doctor-octopus.png', 3, 6, 4, 'villain'),
('Venom', '/images/cards/venom.webp', 5, 4, 4, 'villain'),
('Red Skull', '/images/cards/red_skull.png', 3, 4, 3, 'villain'),
('Electro', '/images/cards/electro.webp', 6, 2, 4, 'villain'),
('Loki', '/images/cards/loki.png', 5, 7, 5, 'villain'),
('Ultron', '/images/cards/ultron.png', 8, 5, 6, 'villain'),
('Magneto', '/images/cards/magneto.png', 6, 8, 6, 'villain'),
('Doctor Doom', '/images/cards/doctor_doom.png', 7, 8, 6, 'villain'),
('Carnage', '/images/cards/carnage.webp', 7, 3, 5, 'villain'),
('Mysterio', '/images/cards/mysterio.png', 4, 6, 4, 'villain'),
('Hela', '/images/cards/hela.png', 8, 6, 7, 'villain'),
('Kingpin', '/images/cards/kingpin.png', 4, 7, 4, 'villain'),
('Sandman', '/images/cards/sandman.webp', 5, 5, 4, 'villain'),
('Juggernaut', '/images/cards/juggernaut.png', 7, 6, 5, 'villain'),
('Sabretooth', '/images/cards/sabretooth.webp', 5, 4, 4, 'villain')
ON DUPLICATE KEY UPDATE
  image = VALUES(image),
  attack = VALUES(attack),
  defense = VALUES(defense),
  cost = VALUES(cost),
  faction = VALUES(faction);
