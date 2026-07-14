CREATE TABLE audience_members (
  audience_id integer NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(email) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (audience_id, email)
);

CREATE TABLE campaign_recipients (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  email text NOT NULL CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, content_hash, email)
);

CREATE INDEX campaign_recipients_lookup_idx
  ON campaign_recipients (campaign_id, content_hash);
