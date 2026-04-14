CREATE TYPE STATUS AS ENUM('TEST','RUNNING','END','PLANNED');
CREATE TABLE users(
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  affiliation VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
CREATE TABLE Profile(
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  nickname VARCHAR(50),
  bio TEXT,
  image_url TEXT,
  deleted_at TIMESTAMP
);
CREATE TABLE Contest(
  id SERIAL PRIMARY KEY,
  title VARCHAR(50),
  description_url TEXT,
  status STATUS,
  -- status TEXT CHECK (status IN ('TEST','RUNNING','END','PLANNED')),
  certifictaion BOOLEAN, -- True for certifiaction contest
  judge_code_url TEXT,
  example_code_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
CREATE TABLE Submission(
  id SERIAL PRIMARY KEY ,
  user_id INT REFERENCES users(id),
  contest_id INT REFERENCES Contest(id),
  code_url TEXT,
  result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE Participant(
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  contest_id INT REFERENCES Contest(id),
  score INT,
  submission_id INT REFERENCES submission(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, contest_id)
);
CREATE TABLE Match(
  id SERIAL PRIMARY KEY,
  contest_id INT REFERENCES Contest(id),
  user1_id INT REFERENCES users(id),
  user2_id INT REFERENCES users(id),
  winner_id INT REFERENCES users(id),
  log TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Contest_Example_AI(
  id SERIAL PRIMARY KEY,
  contest_id INT REFERENCES Contest(id),
  example_order int, -- order는 키워드라 합니다.
  description TEXT,
  code_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);