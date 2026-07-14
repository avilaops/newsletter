CREATE TABLE content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  source_type text NOT NULL CHECK (source_type IN ('rss', 'website', 'api')),
  url text NOT NULL CHECK (url ~ '^https?://'),
  category text NOT NULL DEFAULT 'geral' CHECK (btrim(category) <> ''),
  schedule text NOT NULL DEFAULT '0 * * * *' CHECK (btrim(schedule) <> ''),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url)
);

CREATE TRIGGER content_sources_set_updated_at
BEFORE UPDATE ON content_sources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE audiences (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  external_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE UNIQUE INDEX audiences_external_key_idx
  ON audiences (external_key) WHERE external_key IS NOT NULL;

CREATE TRIGGER audiences_set_updated_at
BEFORE UPDATE ON audiences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE audit_log
  ALTER COLUMN entity_id TYPE text USING entity_id::text;

CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_name text := COALESCE(NULLIF(current_setting('app.actor_id', true), ''), current_user);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(entity_type, entity_id, action, actor, before_data, after_data)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'insert', actor_name, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(entity_type, entity_id, action, actor, before_data, after_data)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'update', actor_name, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO audit_log(entity_type, entity_id, action, actor, before_data, after_data)
    VALUES (TG_TABLE_NAME, OLD.id::text, 'delete', actor_name, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
END;
$$;

ALTER TABLE articles
  ADD COLUMN source_id uuid REFERENCES content_sources(id) ON DELETE SET NULL,
  ADD COLUMN external_key text,
  ADD COLUMN category text NOT NULL DEFAULT 'geral',
  ADD COLUMN status text NOT NULL DEFAULT 'collected'
    CHECK (status IN ('collected', 'selected', 'archived'));

CREATE UNIQUE INDEX articles_source_external_key_idx
  ON articles (source_id, external_key)
  WHERE source_id IS NOT NULL AND external_key IS NOT NULL;

CREATE INDEX articles_status_published_idx
  ON articles (status, published_at DESC);

CREATE TRIGGER content_sources_audit
AFTER INSERT OR UPDATE OR DELETE ON content_sources
FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audiences_audit
AFTER INSERT OR UPDATE OR DELETE ON audiences
FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER articles_audit
AFTER INSERT OR UPDATE OR DELETE ON articles
FOR EACH ROW EXECUTE FUNCTION write_audit_log();
