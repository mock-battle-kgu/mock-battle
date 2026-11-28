SET NAMES utf8mb4;

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

CREATE TABLE stocks (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    sector VARCHAR(20) NOT NULL,
    description VARCHAR(100) NOT NULL
);

INSERT INTO stocks (code, name, sector, description) VALUES
('GANA', '가나전자', '반도체', '메모리 반도체를 만드는 국내 대표 전자 기업'),
('DARA', '다라항공', '항공', '국제선 비중이 높은 대형 항공사, 유가에 민감'),
('MABA', '마바게임즈', '게임', '모바일 게임 흥행에 따라 실적이 크게 바뀜'),
('SAAH', '사아바이오', '바이오', '신약 임상 결과에 주가가 크게 움직이는 바이오 기업'),
('JACHA', '자차푸드', '식품', '경기를 덜 타는 안정적인 식품 회사'),
('KATA', '카타에너지', '에너지', '정유·발전 사업을 하는 에너지 기업');