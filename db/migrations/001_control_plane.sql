CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (btrim(title) <> ''),
  summary text,
  body text NOT NULL CHECK (btrim(body) <> ''),
  source_url text,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX articles_published_at_idx ON articles (published_at DESC);
CREATE INDEX articles_content_hash_idx ON articles (content_hash);

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL CHECK (template_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  subject text NOT NULL CHECK (btrim(subject) <> ''),
  preview_text text NOT NULL DEFAULT '',
  html_content text NOT NULL CHECK (btrim(html_content) <> ''),
  text_content text,
  content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, version)
);

CREATE INDEX templates_active_key_idx ON templates (template_key) WHERE is_active;

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  subject text NOT NULL CHECK (btrim(subject) <> ''),
  preview_text text NOT NULL DEFAULT '',
  html_content text NOT NULL CHECK (btrim(html_content) <> ''),
  audience_list_ids integer[] NOT NULL DEFAULT '{}'::integer[],
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  approved_hash varchar(64) CHECK (approved_hash ~ '^[0-9a-f]{64}$'),
  approved_by text,
  approved_at timestamptz,
  rejection_reason text,
  remote_campaign_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT campaigns_audience_ids_positive CHECK (
    array_position(audience_list_ids, NULL) IS NULL
    AND 0 < ALL (audience_list_ids)
  ),
  CONSTRAINT campaigns_approval_shape CHECK (
    (
      status = 'approved'
      AND approved_hash IS NOT NULL
      AND approved_hash = content_hash
      AND approved_by IS NOT NULL
      AND approved_at IS NOT NULL
    )
    OR (
      status <> 'approved'
      AND approved_hash IS NULL
      AND approved_by IS NULL
      AND approved_at IS NULL
    )
  ),
  CONSTRAINT campaigns_rejection_shape CHECK (
    (status = 'rejected' AND rejection_reason IS NOT NULL AND btrim(rejection_reason) <> '')
    OR (status <> 'rejected' AND rejection_reason IS NULL)
  )
);

CREATE INDEX campaigns_status_idx ON campaigns (status, updated_at DESC);

CREATE TABLE campaign_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_by text NOT NULL CHECK (btrim(decided_by) <> ''),
  reason text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_approvals_reason_required CHECK (
    (decision = 'rejected' AND reason IS NOT NULL AND btrim(reason) <> '')
    OR decision = 'approved'
  )
);

CREATE INDEX campaign_approvals_campaign_idx
  ON campaign_approvals (campaign_id, decided_at DESC);

CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'dispatching', 'dispatched', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, content_hash)
);

CREATE INDEX outbox_pending_idx
  ON outbox (available_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (btrim(entity_type) <> ''),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (btrim(action) <> ''),
  actor text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx
  ON audit_log (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER articles_set_updated_at
BEFORE UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER templates_set_updated_at
BEFORE UPDATE ON templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER outbox_set_updated_at
BEFORE UPDATE ON outbox
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION guard_campaign_content_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  content_changed boolean;
BEGIN
  content_changed :=
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.subject IS DISTINCT FROM OLD.subject
    OR NEW.preview_text IS DISTINCT FROM OLD.preview_text
    OR NEW.html_content IS DISTINCT FROM OLD.html_content
    OR NEW.audience_list_ids IS DISTINCT FROM OLD.audience_list_ids;

  IF content_changed THEN
    IF NEW.content_hash IS NOT DISTINCT FROM OLD.content_hash THEN
      RAISE EXCEPTION 'content_hash must change when campaign content changes'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.status := 'draft';
    NEW.approved_hash := NULL;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.rejection_reason := NULL;
    NEW.remote_campaign_id := NULL;
    NEW.version := OLD.version + 1;

    UPDATE outbox
       SET status = 'cancelled',
           locked_at = NULL,
           last_error = 'Campaign approval invalidated by content change'
     WHERE campaign_id = OLD.id
       AND content_hash = OLD.content_hash
       AND status IN ('queued', 'dispatching', 'failed');
  ELSIF NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'content_hash cannot change without a campaign content change'
      USING ERRCODE = 'check_violation';
  ELSIF OLD.status = 'approved' AND NEW.status = 'approved' AND (
    NEW.approved_hash IS DISTINCT FROM OLD.approved_hash
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  ) THEN
    RAISE EXCEPTION 'approval evidence is immutable while a campaign remains approved'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaign_10_content_guard
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION guard_campaign_content_change();

CREATE OR REPLACE FUNCTION guard_campaign_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status = 'in_review')
    OR (OLD.status = 'in_review' AND NEW.status IN ('approved', 'rejected'))
    OR (OLD.status IN ('in_review', 'approved', 'rejected') AND NEW.status = 'draft')
  ) THEN
    RAISE EXCEPTION 'invalid campaign transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaign_20_state_guard
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION guard_campaign_state_transition();

CREATE OR REPLACE FUNCTION validate_campaign_decision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_campaign campaigns%ROWTYPE;
BEGIN
  SELECT * INTO current_campaign
    FROM campaigns
   WHERE id = NEW.campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign % not found', NEW.campaign_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF current_campaign.status <> 'in_review' THEN
    RAISE EXCEPTION 'campaign must be in_review before a decision'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.content_hash <> current_campaign.content_hash THEN
    RAISE EXCEPTION 'decision hash does not match current campaign hash'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaign_approvals_10_validate
BEFORE INSERT ON campaign_approvals
FOR EACH ROW EXECUTE FUNCTION validate_campaign_decision();

CREATE OR REPLACE FUNCTION apply_campaign_decision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.decision = 'approved' THEN
    UPDATE campaigns
       SET status = 'approved',
           approved_hash = NEW.content_hash,
           approved_by = NEW.decided_by,
           approved_at = NEW.decided_at,
           rejection_reason = NULL,
           version = version + 1
     WHERE id = NEW.campaign_id;
  ELSE
    UPDATE campaigns
       SET status = 'rejected',
           approved_hash = NULL,
           approved_by = NULL,
           approved_at = NULL,
           rejection_reason = NEW.reason,
           version = version + 1
     WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaign_approvals_20_apply
AFTER INSERT ON campaign_approvals
FOR EACH ROW EXECUTE FUNCTION apply_campaign_decision();

CREATE OR REPLACE FUNCTION require_recorded_campaign_decision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' AND NOT EXISTS (
    SELECT 1
      FROM campaign_approvals
     WHERE campaign_id = NEW.id
       AND content_hash = NEW.content_hash
       AND decision = 'approved'
  ) THEN
    RAISE EXCEPTION 'approved campaign requires a matching approval record'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'rejected' AND NOT EXISTS (
    SELECT 1
      FROM campaign_approvals
     WHERE campaign_id = NEW.id
       AND content_hash = NEW.content_hash
       AND decision = 'rejected'
  ) THEN
    RAISE EXCEPTION 'rejected campaign requires a matching rejection record'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER campaign_30_decision_guard
AFTER INSERT OR UPDATE ON campaigns
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION require_recorded_campaign_decision();

CREATE OR REPLACE FUNCTION guard_outbox_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_campaign campaigns%ROWTYPE;
  must_revalidate boolean;
BEGIN
  must_revalidate := TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND NEW.status = 'dispatching' AND OLD.status <> 'dispatching');

  IF TG_OP = 'INSERT' AND (NEW.status <> 'queued' OR NEW.attempts <> 0) THEN
    RAISE EXCEPTION 'new outbox records must start queued with zero attempts'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NOT (
    (OLD.status = 'queued' AND NEW.status IN ('dispatching', 'cancelled'))
    OR (OLD.status = 'dispatching' AND NEW.status IN ('dispatched', 'failed', 'cancelled'))
    OR (OLD.status = 'dispatched' AND NEW.status IN ('sent', 'failed'))
    OR (OLD.status = 'failed' AND NEW.status IN ('dispatching', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'invalid outbox transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF must_revalidate THEN
    SELECT * INTO current_campaign
      FROM campaigns
     WHERE id = NEW.campaign_id
     FOR SHARE;

    IF current_campaign.status <> 'approved'
       OR current_campaign.content_hash <> NEW.content_hash
       OR current_campaign.approved_hash <> NEW.content_hash
       OR cardinality(current_campaign.audience_list_ids) = 0
       OR NOT EXISTS (
         SELECT 1
           FROM campaign_approvals
          WHERE campaign_id = current_campaign.id
            AND content_hash = NEW.content_hash
            AND decision = 'approved'
       ) THEN
      RAISE EXCEPTION 'outbox requires the exact approved campaign hash'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER outbox_10_guard
BEFORE INSERT OR UPDATE ON outbox
FOR EACH ROW EXECUTE FUNCTION guard_outbox_write();

CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_name text := COALESCE(NULLIF(current_setting('app.actor_id', true), ''), current_user);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(entity_type, entity_id, action, actor, before_data, after_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'insert', actor_name, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(entity_type, entity_id, action, actor, before_data, after_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', actor_name, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO audit_log(entity_type, entity_id, action, actor, before_data, after_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', actor_name, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER campaigns_audit
AFTER INSERT OR UPDATE OR DELETE ON campaigns
FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER campaign_approvals_audit
AFTER INSERT OR UPDATE OR DELETE ON campaign_approvals
FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER outbox_audit
AFTER INSERT OR UPDATE OR DELETE ON outbox
FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE OR REPLACE FUNCTION keep_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION keep_audit_log_append_only();
