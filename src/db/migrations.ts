export type Migration = {
  version: number;
  sql: string;
};

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE day_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_bodyweight INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL DEFAULT 3,
  position INTEGER NOT NULL
);
CREATE INDEX idx_day_exercises_day ON day_exercises(day_id);

CREATE TABLE workout_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER REFERENCES days(id) ON DELETE SET NULL,
  day_name_snapshot TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active','completed'))
);
CREATE INDEX idx_workout_logs_started ON workout_logs(started_at);

CREATE TABLE logged_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_log_id INTEGER NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_bodyweight INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  position INTEGER NOT NULL
);
CREATE INDEX idx_logged_exercises_log ON logged_exercises(workout_log_id);
CREATE INDEX idx_logged_exercises_name ON logged_exercises(name COLLATE NOCASE);

CREATE TABLE logged_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  is_confirmed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);
CREATE INDEX idx_logged_sets_exercise ON logged_sets(logged_exercise_id);

CREATE TABLE body_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  weight_kg REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE daily_steps (
  date TEXT PRIMARY KEY,
  steps INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
  },
  {
    version: 2,
    sql: `ALTER TABLE logged_exercises ADD COLUMN weight_unit TEXT;`,
  },
];
