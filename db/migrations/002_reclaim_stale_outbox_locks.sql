CREATE OR REPLACE FUNCTION guard_outbox_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_campaign campaigns%ROWTYPE;
  must_revalidate boolean;
BEGIN
  must_revalidate := TG_OP = 'INSERT'
    OR (
      TG_OP = 'UPDATE'
      AND NEW.status = 'dispatching'
      AND (OLD.status <> 'dispatching' OR NEW.attempts > OLD.attempts)
    );

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
