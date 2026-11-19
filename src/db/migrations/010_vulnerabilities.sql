CREATE TABLE IF NOT EXISTS vulnerabilities (
  id BIGSERIAL PRIMARY KEY,
  vuln_id TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  title TEXT,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'UNKNOWN',
  cvss_score NUMERIC(3,1),
  cvss_version TEXT,
  cvss_vector TEXT,
  cvss_source TEXT,
  cwes TEXT[] NOT NULL DEFAULT '{}',
  vendors TEXT[] NOT NULL DEFAULT '{}',
  products TEXT[] NOT NULL DEFAULT '{}',
  packages TEXT[] NOT NULL DEFAULT '{}',
  refs TEXT[] NOT NULL DEFAULT '{}',
  vuln_status TEXT,
  kev BOOLEAN NOT NULL DEFAULT FALSE,
  kev_date_added DATE,
  kev_due_date DATE,
  kev_required_action TEXT,
  kev_ransomware TEXT,
  sources TEXT[] NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ,
  last_modified_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  update_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vulns_last_modified ON vulnerabilities (last_modified_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vulns_published ON vulnerabilities (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vulns_severity ON vulnerabilities (severity);
CREATE INDEX IF NOT EXISTS idx_vulns_score ON vulnerabilities (cvss_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vulns_kev ON vulnerabilities (kev_date_added DESC) WHERE kev;
CREATE INDEX IF NOT EXISTS idx_vulns_aliases ON vulnerabilities USING GIN (aliases);

CREATE TABLE IF NOT EXISTS vuln_sync_state (
  source TEXT PRIMARY KEY,
  cursor_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_result JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
