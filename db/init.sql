CREATE TABLE games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id CHAR(6) NOT NULL,
    mode ENUM('battle', 'practice') NOT NULL,
    played_at DATETIME NOT NULL,
    duration_sec INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    nickname VARCHAR(10) NOT NULL,
    rank_no TINYINT NOT NULL,
    return_pct DECIMAL(6,1) NOT NULL,
    total_asset BIGINT NOT NULL,
    rumors_used TINYINT NOT NULL DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    INDEX idx_return (return_pct)
);