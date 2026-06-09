-- status enum: 구버전에 누락된 값 보완
ALTER TYPE status ADD VALUE IF NOT EXISTS 'CANCELED';

-- code_battle_contest: 구버전 스키마에 누락된 컬럼 보완
ALTER TABLE code_battle_contest
    ADD COLUMN IF NOT EXISTS creator_id BIGINT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS visualization_html_url TEXT,
    ADD COLUMN IF NOT EXISTS solo_play_html_url TEXT;

ALTER TABLE code_battle_contest
    ALTER COLUMN description TYPE TEXT;

-- code_battle_participant: 구버전 스키마에 누락된 컬럼 보완
ALTER TABLE code_battle_participant
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE NOT NULL;

-- payment 테이블 신규 생성
CREATE TABLE payment (
    id          BIGSERIAL PRIMARY KEY,
    payment_key VARCHAR(255) NOT NULL UNIQUE,
    order_id    VARCHAR(255) NOT NULL UNIQUE,
    amount      BIGINT       NOT NULL,
    status      VARCHAR(50)  NOT NULL,
    method      VARCHAR(100),
    contest_id  BIGINT REFERENCES code_battle_contest(id),
    user_id     BIGINT REFERENCES users(id),
    paid_at     TIMESTAMP,
    created_at  TIMESTAMP    NOT NULL,
    updated_at  TIMESTAMP    NOT NULL
);
