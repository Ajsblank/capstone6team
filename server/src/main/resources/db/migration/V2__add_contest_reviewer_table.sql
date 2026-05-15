-- Ensure contest reviewer table exists for already-provisioned databases.
CREATE TABLE IF NOT EXISTS contest_reviewer (
    id BIGSERIAL PRIMARY KEY,
    contest_id BIGINT NOT NULL,
    reviewer_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contest_reviewer_contest FOREIGN KEY (contest_id) REFERENCES code_battle_contest (id) ON DELETE CASCADE,
    CONSTRAINT uk_contest_reviewer_email UNIQUE (contest_id, reviewer_email)
);

CREATE INDEX IF NOT EXISTS idx_contest_reviewer_contest_id ON contest_reviewer (contest_id);
