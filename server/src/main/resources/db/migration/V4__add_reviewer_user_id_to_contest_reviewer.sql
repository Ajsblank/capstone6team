ALTER TABLE contest_reviewer
    ADD COLUMN IF NOT EXISTS reviewer_user_id BIGINT;

UPDATE contest_reviewer cr
SET reviewer_user_id = u.id
FROM users u
WHERE cr.reviewer_email = u.email
  AND cr.reviewer_user_id IS NULL;

ALTER TABLE contest_reviewer
    ALTER COLUMN reviewer_user_id SET NOT NULL;

ALTER TABLE contest_reviewer
    ADD CONSTRAINT fk_contest_reviewer_user
        FOREIGN KEY (reviewer_user_id) REFERENCES users (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uk_contest_reviewer_user
    ON contest_reviewer (contest_id, reviewer_user_id);