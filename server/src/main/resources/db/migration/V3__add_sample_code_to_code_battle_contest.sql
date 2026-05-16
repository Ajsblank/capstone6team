-- Align existing production schemas with current JPA mapping.
-- Some environments were baselined before sample_code existed.
ALTER TABLE code_battle_contest
    ADD COLUMN IF NOT EXISTS sample_code TEXT;
