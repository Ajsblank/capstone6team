-- =========================================================
-- ENUM TYPES
-- =========================================================

CREATE TYPE status AS ENUM (
    'PLANNED',
    'RUNNING',
    'PAUSED',
    'END',
    'CANCELED', -- 취소 상태 추가
    'TEST'
);

CREATE TYPE match_status AS ENUM (
    'READY',
    'RUNNING',
    'FINISHED'
);

CREATE TYPE language AS ENUM (
    'JAVA',
    'PYTHON',
    'C',
    'CPP'
);

CREATE TYPE result_type AS ENUM (
    'WIN',
    'DRAW',
    'PENDING',
    'BYE'
);

-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================================================
-- PROFILE
-- =========================================================

CREATE TABLE profile (
    user_id BIGINT PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL,
    tag INTEGER NOT NULL,
    affiliation TEXT, -- VARCHAR(50) -> TEXT
    bio TEXT,
    image_url VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_profile_nickname_tag UNIQUE (nickname, tag),
    CONSTRAINT chk_profile_tag CHECK (
        tag >= 1
        AND tag <= 9999
    ),
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- =========================================================
-- ALGORITHM PROBLEM
-- =========================================================

CREATE TABLE algorithm_problem (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL, -- VARCHAR(255) -> TEXT
    description TEXT NOT NULL,
    category VARCHAR(50),
    total_submission INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    input_description TEXT,
    output_description TEXT,
    example_testcases TEXT,
    hidden_testcases TEXT,
    time_limit_sec INTEGER,
    memory_limit_mb INTEGER
);

-- =========================================================
-- ALGORITHM SUBMISSION
-- =========================================================

CREATE TABLE algorithm_submission (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    problem_id BIGINT,
    language language,
    code TEXT, -- VARCHAR(255) -> TEXT
    result TEXT, -- VARCHAR(255) -> TEXT
    execution_time_sec INTEGER,
    memory_usage_mb INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_algorithm_submission_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_algorithm_submission_problem FOREIGN KEY (problem_id) REFERENCES algorithm_problem (id)
);

-- =========================================================
-- CODE BATTLE CONTEST
-- =========================================================

CREATE TABLE code_battle_contest (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    creator_id BIGINT NOT NULL,
    time_limit_sec INTEGER NOT NULL,
    memory_limit_mb INTEGER NOT NULL,
    max_participants INTEGER NOT NULL,
    status status NOT NULL,
    certification BOOLEAN NOT NULL,
    judge_code TEXT, -- VARCHAR(255) -> TEXT
    sample_code TEXT, -- 신규 생성: 제공 스켈레톤 코드
    visualization_html_url TEXT, -- VARCHAR(255) -> TEXT
    solo_play_html_url TEXT, -- VARCHAR(255) -> TEXT
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    CONSTRAINT chk_contest_time_limit CHECK (time_limit_sec > 0),
    CONSTRAINT chk_contest_memory_limit CHECK (memory_limit_mb > 0),
    CONSTRAINT chk_contest_max_participants CHECK (max_participants > 0),
    CONSTRAINT fk_contest_user FOREIGN KEY (creator_id) REFERENCES users (id)
);

-- =========================================================
-- CODE BATTLE EXAMPLE AI
-- =========================================================

CREATE TABLE code_battle_example_ai (
    id BIGSERIAL PRIMARY KEY,
    contest_id BIGINT,
    example_order INTEGER,
    -- description 삭제 (용도 모름)
    code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contest_example_ai_contest FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id)
);

-- =========================================================
-- CODE BATTLE SUBMISSION
-- =========================================================

CREATE TABLE code_battle_submission (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    contest_id BIGINT,
    language language NOT NULL,
    code_url TEXT,
    result VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_submission_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_submission_contest FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id)
);

-- =========================================================
-- CODE BATTLE PARTICIPANT
-- =========================================================

CREATE TABLE code_battle_participant (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    contest_id BIGINT,
    submission_id BIGINT, -- 최종 제출 참조용
    is_manual BOOLEAN DEFAULT FALSE NOT NULL, -- is_manual 추가, 최종 제출 저장 옵션
    score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_participant_user_contest UNIQUE (user_id, contest_id),
    CONSTRAINT fk_participant_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_participant_contest FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id),
    CONSTRAINT fk_participant_submission FOREIGN KEY (submission_id) REFERENCES code_battle_submission (id)
);

-- =========================================================
-- CODE BATTLE MATCH
-- =========================================================

CREATE TABLE code_battle_match (
    id BIGSERIAL PRIMARY KEY,
    contest_id BIGINT,
    user1_id BIGINT,
    user2_id BIGINT,
    winner_id BIGINT,
    submission_id BIGINT, -- 필요 없음 추후 삭제 고려
    ai_order INTEGER,
    log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_match_contest_user_pair UNIQUE (
        contest_id,
        user1_id,
        user2_id
    ),
    --CONSTRAINT chk_match_user_order CHECK (user1_id < user2_id),
    CONSTRAINT fk_match_contest FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id),
    CONSTRAINT fk_match_user1 FOREIGN KEY (user1_id) REFERENCES users (id),
    CONSTRAINT fk_match_user2 FOREIGN KEY (user2_id) REFERENCES users (id),
    CONSTRAINT fk_match_winner FOREIGN KEY (winner_id) REFERENCES users (id),
    CONSTRAINT fk_match_submission FOREIGN KEY (submission_id) REFERENCES code_battle_submission (id)
);

-- =========================================================
-- CONTEST SCHEDULE
-- =========================================================

CREATE TABLE contest_schedule (
    id BIGSERIAL PRIMARY KEY,
    contest_id BIGINT NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_contest_id FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id)
);

-- =========================================================
-- CONTEST SWISS SESSION
-- =========================================================

CREATE TABLE contest_swiss_session (
    id BIGSERIAL PRIMARY KEY,
    contest_id BIGINT NOT NULL,
    session_number INT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at TIMESTAMP,
    CONSTRAINT fk_contest_id FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id)
);
-- =========================================================
-- CONTEST SWISS ROUND
-- =========================================================

CREATE TABLE contest_swiss_round (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    round_number INT,
    status match_status,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at TIMESTAMP,
    CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES contest_swiss_session (id)
);
-- =========================================================
-- CONTEST INTERIM MATCH
-- =========================================================

CREATE TABLE contest_swiss_match (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL,
    user1_id BIGINT,
    user2_id BIGINT,
    winner_id BIGINT,
    result result_type,
    log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_round_id FOREIGN KEY (round_id) REFERENCES contest_swiss_round (id)
);

-- =========================================================
-- CONTEST REVIEWER - 인증 대회 검수자 관리
-- =========================================================

CREATE TABLE contest_reviewer (
    id BIGSERIAL PRIMARY KEY,
    contest_id BIGINT NOT NULL,
    reviewer_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contest_reviewer_contest FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE,
    CONSTRAINT uk_contest_reviewer_email UNIQUE (contest_id, reviewer_email)
);

CREATE INDEX idx_contest_reviewer_contest_id ON contest_reviewer (contest_id);