-- ========================
-- ENUM TYPES
-- ========================

CREATE TYPE conteststatus AS ENUM (
    'CANCELED',
    'END',
    'PAUSED',
    'PLANNED',
    'RUNNING',
    'TEST'
);

CREATE TYPE language AS ENUM (
    'C',
    'CPP',
    'JAVA',
    'PYTHON'
);

CREATE TYPE match_status AS ENUM (
    'READY',
    'RUNNING',
    'FINISHED',
    'CANCELED'
);

CREATE TYPE result_type AS ENUM (
    'WIN',
    'DRAW',
    'PENDING',
    'BYE',
    'WIN1',
    'WIN2'
);

CREATE TYPE status AS ENUM (
    'PLANNED',
    'RUNNING',
    'PAUSED',
    'END',
    'CANCELED',
    'TEST'
);

-- ========================
-- TABLES
-- ========================

CREATE TABLE users (
    id            BIGINT       NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password      VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP
);

CREATE TABLE profile (
    user_id       BIGINT       NOT NULL,
    nickname      VARCHAR(50)  NOT NULL,
    tag           INTEGER      NOT NULL,
    affiliation   VARCHAR(50),
    bio           TEXT,
    image_url     VARCHAR(255),
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_profile_tag CHECK (tag >= 1 AND tag <= 9999)
);

CREATE TABLE code_battle_contest (
    id                      BIGINT       NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT         NOT NULL,
    creator_id              BIGINT,
    time_limit_sec          INTEGER      NOT NULL,
    memory_limit_mb         INTEGER      NOT NULL,
    max_participants        INTEGER      NOT NULL,
    status                  status       NOT NULL,
    certification           BOOLEAN      NOT NULL,
    judge_code              TEXT,
    sample_code             TEXT,
    visualization_html_url  TEXT,
    solo_play_html_url      TEXT,
    start_date              TIMESTAMP,
    end_date                TIMESTAMP,
    created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at              TIMESTAMP,
    judge_language          language     DEFAULT 'CPP'::language   NOT NULL,
    CONSTRAINT chk_contest_max_participants CHECK (max_participants > 0),
    CONSTRAINT chk_contest_memory_limit     CHECK (memory_limit_mb > 0),
    CONSTRAINT chk_contest_time_limit       CHECK (time_limit_sec > 0)
);

CREATE TABLE code_battle_example_ai (
    id             BIGINT    NOT NULL,
    contest_id     BIGINT,
    example_order  BIGINT,
    code           TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description    TEXT,
    language       language  DEFAULT 'CPP'::language
);

CREATE TABLE code_battle_sample_code (
    id            BIGINT    NOT NULL,
    contest_id    BIGINT,
    sample_order  BIGINT,
    code          TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    language      language  DEFAULT 'CPP'::language
);

CREATE TABLE code_battle_submission (
    id          BIGINT       NOT NULL,
    user_id     BIGINT,
    contest_id  BIGINT,
    code_url    TEXT,
    result      VARCHAR(255),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    language    language     NOT NULL
);

CREATE TABLE code_battle_match (
    id            BIGINT      NOT NULL,
    contest_id    BIGINT,
    user1_id      BIGINT,
    user2_id      BIGINT,
    winner_id     BIGINT,
    submission_id BIGINT,
    ai_order      BIGINT,
    log           TEXT,
    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    result        VARCHAR(10) DEFAULT 'PENDING'
);

CREATE TABLE code_battle_participant (
    id            BIGINT    NOT NULL,
    user_id       BIGINT,
    contest_id    BIGINT,
    submission_id BIGINT,
    is_manual     BOOLEAN   DEFAULT false NOT NULL,
    score         INTEGER,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contest_reviewer (
    id               BIGINT       NOT NULL,
    contest_id       BIGINT       NOT NULL,
    reviewer_email   VARCHAR(255) NOT NULL,
    reviewer_user_id BIGINT,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contest_schedule (
    id            BIGINT         NOT NULL,
    contest_id    BIGINT         NOT NULL,
    scheduled_at  TIMESTAMP      NOT NULL,
    created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status        conteststatus  DEFAULT 'PLANNED'::conteststatus NOT NULL
);

CREATE TABLE contest_swiss_session (
    id              BIGINT    NOT NULL,
    contest_id      BIGINT    NOT NULL,
    session_number  INTEGER,
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at     TIMESTAMP,
    scheduled_at    TIMESTAMP,
    status          status    DEFAULT 'PLANNED'::status NOT NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE contest_swiss_round (
    id            BIGINT       NOT NULL,
    session_id    BIGINT       NOT NULL,
    round_number  INTEGER,
    status        match_status,
    started_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at   TIMESTAMP
);

CREATE TABLE contest_swiss_match (
    id          BIGINT      NOT NULL,
    round_id    BIGINT      NOT NULL,
    user1_id    BIGINT,
    user2_id    BIGINT,
    winner_id   BIGINT,
    result      result_type,
    log         TEXT,
    created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE payment (
    id           BIGINT       NOT NULL,
    payment_key  VARCHAR(255) NOT NULL,
    order_id     VARCHAR(255) NOT NULL,
    amount       BIGINT       NOT NULL,
    status       VARCHAR(255) NOT NULL,
    method       VARCHAR(255),
    contest_id   BIGINT,
    user_id      BIGINT,
    paid_at      TIMESTAMP,
    created_at   TIMESTAMP    NOT NULL,
    updated_at   TIMESTAMP    NOT NULL
);

-- ========================
-- SEQUENCES
-- ========================

CREATE SEQUENCE users_id_seq                   START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE code_battle_contest_id_seq     START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE code_battle_example_ai_id_seq  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE code_battle_sample_code_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE code_battle_submission_id_seq  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE code_battle_match_id_seq       START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE code_battle_participant_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE contest_reviewer_id_seq        START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE contest_schedule_id_seq        START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE contest_swiss_session_id_seq   START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE contest_swiss_round_id_seq     START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE contest_swiss_match_id_seq     START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE payment_id_seq                 START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE users_id_seq                    OWNED BY users.id;
ALTER SEQUENCE code_battle_contest_id_seq      OWNED BY code_battle_contest.id;
ALTER SEQUENCE code_battle_example_ai_id_seq   OWNED BY code_battle_example_ai.id;
ALTER SEQUENCE code_battle_sample_code_id_seq  OWNED BY code_battle_sample_code.id;
ALTER SEQUENCE code_battle_submission_id_seq   OWNED BY code_battle_submission.id;
ALTER SEQUENCE code_battle_match_id_seq        OWNED BY code_battle_match.id;
ALTER SEQUENCE code_battle_participant_id_seq  OWNED BY code_battle_participant.id;
ALTER SEQUENCE contest_reviewer_id_seq         OWNED BY contest_reviewer.id;
ALTER SEQUENCE contest_schedule_id_seq         OWNED BY contest_schedule.id;
ALTER SEQUENCE contest_swiss_session_id_seq    OWNED BY contest_swiss_session.id;
ALTER SEQUENCE contest_swiss_round_id_seq      OWNED BY contest_swiss_round.id;
ALTER SEQUENCE contest_swiss_match_id_seq      OWNED BY contest_swiss_match.id;
ALTER SEQUENCE payment_id_seq                  OWNED BY payment.id;

-- ========================
-- SET DEFAULT (nextval)
-- ========================

ALTER TABLE ONLY users                   ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);
ALTER TABLE ONLY code_battle_contest     ALTER COLUMN id SET DEFAULT nextval('code_battle_contest_id_seq'::regclass);
ALTER TABLE ONLY code_battle_example_ai  ALTER COLUMN id SET DEFAULT nextval('code_battle_example_ai_id_seq'::regclass);
ALTER TABLE ONLY code_battle_sample_code ALTER COLUMN id SET DEFAULT nextval('code_battle_sample_code_id_seq'::regclass);
ALTER TABLE ONLY code_battle_submission  ALTER COLUMN id SET DEFAULT nextval('code_battle_submission_id_seq'::regclass);
ALTER TABLE ONLY code_battle_match       ALTER COLUMN id SET DEFAULT nextval('code_battle_match_id_seq'::regclass);
ALTER TABLE ONLY code_battle_participant ALTER COLUMN id SET DEFAULT nextval('code_battle_participant_id_seq'::regclass);
ALTER TABLE ONLY contest_reviewer        ALTER COLUMN id SET DEFAULT nextval('contest_reviewer_id_seq'::regclass);
ALTER TABLE ONLY contest_schedule        ALTER COLUMN id SET DEFAULT nextval('contest_schedule_id_seq'::regclass);
ALTER TABLE ONLY contest_swiss_session   ALTER COLUMN id SET DEFAULT nextval('contest_swiss_session_id_seq'::regclass);
ALTER TABLE ONLY contest_swiss_round     ALTER COLUMN id SET DEFAULT nextval('contest_swiss_round_id_seq'::regclass);
ALTER TABLE ONLY contest_swiss_match     ALTER COLUMN id SET DEFAULT nextval('contest_swiss_match_id_seq'::regclass);
ALTER TABLE ONLY payment                 ALTER COLUMN id SET DEFAULT nextval('payment_id_seq'::regclass);

-- ========================
-- PRIMARY KEYS & UNIQUE
-- ========================

ALTER TABLE ONLY users                 ADD CONSTRAINT users_pkey                     PRIMARY KEY (id);
ALTER TABLE ONLY users                 ADD CONSTRAINT users_email_key                UNIQUE (email);

ALTER TABLE ONLY profile               ADD CONSTRAINT profile_pkey                   PRIMARY KEY (user_id);
ALTER TABLE ONLY profile               ADD CONSTRAINT uq_profile_nickname_tag        UNIQUE (nickname, tag);

ALTER TABLE ONLY code_battle_contest   ADD CONSTRAINT code_battle_contest_pkey      PRIMARY KEY (id);

ALTER TABLE ONLY code_battle_example_ai  ADD CONSTRAINT code_battle_example_ai_pkey  PRIMARY KEY (id);

ALTER TABLE ONLY code_battle_sample_code ADD CONSTRAINT code_battle_sample_code_pkey PRIMARY KEY (id);

ALTER TABLE ONLY code_battle_submission  ADD CONSTRAINT code_battle_submission_pkey  PRIMARY KEY (id);

ALTER TABLE ONLY code_battle_match     ADD CONSTRAINT code_battle_match_pkey         PRIMARY KEY (id);

ALTER TABLE ONLY code_battle_participant ADD CONSTRAINT code_battle_participant_pkey  PRIMARY KEY (id);
ALTER TABLE ONLY code_battle_participant ADD CONSTRAINT uk_participant_user_contest   UNIQUE (user_id, contest_id);

ALTER TABLE ONLY contest_reviewer      ADD CONSTRAINT contest_reviewer_pkey          PRIMARY KEY (id);
ALTER TABLE ONLY contest_reviewer      ADD CONSTRAINT uk_contest_reviewer_email       UNIQUE (contest_id, reviewer_email);

ALTER TABLE ONLY contest_schedule      ADD CONSTRAINT contest_schedule_pkey          PRIMARY KEY (id);

ALTER TABLE ONLY contest_swiss_session ADD CONSTRAINT contest_swiss_session_pkey     PRIMARY KEY (id);
ALTER TABLE ONLY contest_swiss_round   ADD CONSTRAINT contest_swiss_round_pkey       PRIMARY KEY (id);
ALTER TABLE ONLY contest_swiss_match   ADD CONSTRAINT contest_swiss_match_pkey       PRIMARY KEY (id);

ALTER TABLE ONLY payment               ADD CONSTRAINT payment_pkey                   PRIMARY KEY (id);
ALTER TABLE ONLY payment               ADD CONSTRAINT payment_order_id_key           UNIQUE (order_id);
ALTER TABLE ONLY payment               ADD CONSTRAINT payment_payment_key_key        UNIQUE (payment_key);

-- ========================
-- INDEXES
-- ========================

CREATE INDEX idx_contest_reviewer_contest_id ON contest_reviewer USING btree (contest_id);

-- ========================
-- FOREIGN KEYS
-- ========================

ALTER TABLE ONLY profile
    ADD CONSTRAINT fk_profile_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE ONLY code_battle_contest
    ADD CONSTRAINT fk_contest_user
    FOREIGN KEY (creator_id) REFERENCES users (id);

ALTER TABLE ONLY code_battle_example_ai
    ADD CONSTRAINT fk_contest_example_ai_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE;

ALTER TABLE ONLY code_battle_sample_code
    ADD CONSTRAINT fk_contest_sample_code_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE;

ALTER TABLE ONLY code_battle_submission
    ADD CONSTRAINT fk_submission_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE ONLY code_battle_submission
    ADD CONSTRAINT fk_submission_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE;

ALTER TABLE ONLY code_battle_match
    ADD CONSTRAINT fk_match_user1
    FOREIGN KEY (user1_id) REFERENCES users (id);

ALTER TABLE ONLY code_battle_match
    ADD CONSTRAINT fk_match_user2
    FOREIGN KEY (user2_id) REFERENCES users (id);

ALTER TABLE ONLY code_battle_match
    ADD CONSTRAINT fk_match_winner
    FOREIGN KEY (winner_id) REFERENCES users (id);

ALTER TABLE ONLY code_battle_match
    ADD CONSTRAINT fk_match_submission
    FOREIGN KEY (submission_id) REFERENCES code_battle_submission (id);

ALTER TABLE ONLY code_battle_match
    ADD CONSTRAINT fk_match_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE;

ALTER TABLE ONLY code_battle_participant
    ADD CONSTRAINT fk_participant_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE ONLY code_battle_participant
    ADD CONSTRAINT fk_participant_submission
    FOREIGN KEY (submission_id) REFERENCES code_battle_submission (id);

ALTER TABLE ONLY code_battle_participant
    ADD CONSTRAINT fk_participant_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE;

ALTER TABLE ONLY contest_reviewer
    ADD CONSTRAINT fk_contest_reviewer_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE;

ALTER TABLE ONLY contest_schedule
    ADD CONSTRAINT fk_contest_schedule_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id);

ALTER TABLE ONLY contest_swiss_session
    ADD CONSTRAINT fk_swiss_session_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE;

ALTER TABLE ONLY contest_swiss_round
    ADD CONSTRAINT fk_swiss_round_session
    FOREIGN KEY (session_id) REFERENCES contest_swiss_session (id) ON DELETE CASCADE;

ALTER TABLE ONLY contest_swiss_match
    ADD CONSTRAINT fk_swiss_match_round
    FOREIGN KEY (round_id) REFERENCES contest_swiss_round (id) ON DELETE CASCADE;

ALTER TABLE ONLY payment
    ADD CONSTRAINT fk_payment_contest
    FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE SET NULL;

ALTER TABLE ONLY payment
    ADD CONSTRAINT fk_payment_user
    FOREIGN KEY (user_id) REFERENCES users (id);
