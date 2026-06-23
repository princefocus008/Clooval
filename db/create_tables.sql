-- Postgres DDL for Clooval app
-- Tables: users, providers, requests, notifications, activities

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  student_id TEXT,
  role TEXT NOT NULL,
  phone TEXT,
  nationality TEXT,
  programme_of_study TEXT,
  resident TEXT,
  notification_email BOOLEAN DEFAULT FALSE,
  notification_sms BOOLEAN DEFAULT FALSE,
  notification_in_app BOOLEAN DEFAULT TRUE,
  password_hash TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  specialty TEXT[],
  notes TEXT,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  student_name TEXT,
  student_email TEXT,
  student_phone TEXT,
  category TEXT,
  request_hash TEXT,
  brand TEXT,
  model TEXT,
  accessory_type TEXT,
  issues TEXT[],
  custom_issue TEXT,
  description TEXT,
  photos TEXT[],
  priority TEXT NOT NULL DEFAULT 'normal',
  additional_notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  provider_cost NUMERIC,
  service_charge NUMERIC,
  total_cost NUMERIC,
  is_quote_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  final_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ready_notes TEXT,
  operator_notes TEXT,
  internal_notes TEXT,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  provider_translation TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_student_id ON requests(student_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_request_hash ON requests(request_hash);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id TEXT,
  amount NUMERIC
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id TEXT
);
