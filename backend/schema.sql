CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(11) NOT NULL UNIQUE,
  national_id VARCHAR(10) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  disease_code VARCHAR(30) NOT NULL DEFAULT 'unassigned'
    CHECK (disease_code IN ('migraine','ms','epilepsy','parkinson','cognition','unassigned')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','active','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS patients_created_at_idx ON patients(created_at DESC);
