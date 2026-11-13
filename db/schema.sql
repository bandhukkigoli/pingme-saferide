-- PingME SafeRide database schema (PostgreSQL).
-- Only the BUS is ever located. No table stores any person's location.
-- All people in the seed data are fake.

DROP TABLE IF EXISTS judge_claims, parent_prefs, requests, events, logs, attendance, alerts, scans, trips, tags, children, stops, buses, schools, meta CASCADE;

-- Small key/value table, e.g. routes_version (bumped when the route editor changes stops).
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE schools (id SERIAL PRIMARY KEY, name TEXT NOT NULL);

-- route = the road geometry from OSRM (JSON: coords, cum, stopDist, total, source).
CREATE TABLE buses (
  id INT PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  capacity INT NOT NULL,
  route JSONB
);

-- seq = position in the MORNING route (0 = first pickup, last = the school).
CREATE TABLE stops (
  id SERIAL PRIMARY KEY,
  bus_id INT NOT NULL REFERENCES buses(id),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  seq INT NOT NULL,
  is_school BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE children (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  class_section TEXT NOT NULL,
  tag_code TEXT UNIQUE NOT NULL,
  bus_id INT REFERENCES buses(id),
  stop_id INT REFERENCES stops(id),
  parent_name TEXT NOT NULL,
  masked_phone TEXT NOT NULL,        -- only ever the masked form, never a real number
  status TEXT NOT NULL DEFAULT 'active' -- active | pending
);

-- Every printed bag tag. Some are not registered yet (for the "new rider" demo).
CREATE TABLE tags (
  code TEXT PRIMARY KEY,
  child_id INT REFERENCES children(id),
  registered BOOLEAN NOT NULL DEFAULT FALSE
);

-- One simulated trip of one bus. The bus position is a pure function of time (see lib/sim.ts).
CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  bus_id INT NOT NULL REFERENCES buses(id),
  kind TEXT NOT NULL,                  -- morning | afternoon
  scenario TEXT NOT NULL,              -- normal | missed | wrong | left
  target_child_id INT,
  speed INT NOT NULL DEFAULT 2,
  started_at BIGINT NOT NULL,          -- real time in ms
  paused_at BIGINT,                    -- set while paused
  paused_total_ms BIGINT NOT NULL DEFAULT 0,
  sim_minutes_offset DOUBLE PRECISION NOT NULL DEFAULT 0, -- carried sim minutes when speed changes
  status TEXT NOT NULL DEFAULT 'running', -- running | paused | blocked | closed
  auto_scan BOOLEAN NOT NULL DEFAULT TRUE,
  last_processed_step INT NOT NULL DEFAULT -1,
  ended_step INT,                      -- sim minute when the trip ended or got blocked
  active BOOLEAN NOT NULL DEFAULT TRUE -- only the newest trip per bus is active
);

CREATE TABLE scans (
  id SERIAL PRIMARY KEY,
  trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  child_id INT NOT NULL REFERENCES children(id),
  type TEXT NOT NULL,                  -- on | off | found
  stop_id INT,
  sim_time DOUBLE PRECISION NOT NULL,
  manual BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Red alerts for the school (and attendant). Approaching/boarded notices live in "events".
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  child_id INT NOT NULL REFERENCES children(id),
  type TEXT NOT NULL,                  -- missed | wrong_stop | left_on_bus
  level INT NOT NULL DEFAULT 0,        -- 0 Attendant, 1 Transport in-charge, 2 Principal
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolution TEXT,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  sim_time DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, child_id, type)
);

-- Per trip, per child: where the child is + the attendance text the school sees.
CREATE TABLE attendance (
  trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  child_id INT NOT NULL REFERENCES children(id),
  state TEXT NOT NULL,                 -- waiting | atschool | onboard | dropped | missed
  value TEXT NOT NULL,                 -- "On bus", "In class", "Missed bus", ...
  board_sim DOUBLE PRECISION,
  drop_sim DOUBLE PRECISION,
  drop_stop_id INT,
  PRIMARY KEY (trip_id, child_id)
);

-- Notifications for a parent (timeline + full-screen takeovers).
-- dedupe_key stops the same alert from being created twice when two phones poll at once.
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  trip_id INT REFERENCES trips(id) ON DELETE CASCADE,
  child_id INT NOT NULL REFERENCES children(id),
  kind TEXT NOT NULL,
  color TEXT NOT NULL,
  alarm TEXT NOT NULL,
  needs_response BOOLEAN NOT NULL DEFAULT FALSE,
  params JSONB NOT NULL DEFAULT '{}',
  response TEXT,
  sim_time DOUBLE PRECISION,
  dedupe_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live log for the school (every scan is timestamped = proof of safety).
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,                  -- scan | alert | ok | info
  text TEXT NOT NULL,
  sim_time DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- New rider + stop change requests waiting for the transport desk.
CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,                  -- new_rider | stop_change
  child_id INT REFERENCES children(id),
  payload JSONB NOT NULL,              -- {stopId, name?, classSection?, tagCode?, parentName?}
  effective_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parent_prefs (child_id INT PRIMARY KEY REFERENCES children(id), alert_radius_m INT NOT NULL DEFAULT 1000);

CREATE TABLE judge_claims (child_id INT PRIMARY KEY REFERENCES children(id), claimed_at TIMESTAMPTZ NOT NULL DEFAULT now());
