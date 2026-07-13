import { withTransaction } from "./db.mjs";
import {
  applyCampaignEdit,
  approveCampaign,
  assertQueueable,
  computeCampaignHash,
  rejectCampaign,
  submitForReview,
} from "./domain/index.mjs";

function mapCampaign(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    previewText: row.preview_text,
    htmlContent: row.html_content,
    audienceListIds: row.audience_list_ids,
    status: row.status,
    editorialStatus: row.status,
    deliveryStatus: row.delivery_status ?? null,
    contentHash: row.content_hash,
    approvedHash: row.approved_hash,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at?.toISOString?.() ?? row.approved_at,
    rejectionReason: row.rejection_reason,
    remoteCampaignId: row.remote_campaign_id,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
    version: row.version,
  };
}

function mapOutbox(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contentHash: row.content_hash,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
  };
}

function mapSource(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.source_type,
    url: row.url,
    category: row.category,
    schedule: row.schedule,
    active: row.is_active,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

function mapAudience(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    recipientCount: row.recipient_count,
    externalKey: row.external_key,
    active: row.is_active,
  };
}

function mapArticle(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceId: row.source_id,
    externalKey: row.external_key,
    title: row.title,
    summary: row.summary,
    body: row.body,
    sourceUrl: row.source_url,
    category: row.category,
    status: row.status,
    publishedAt: row.published_at?.toISOString?.() ?? row.published_at,
    metadata: row.metadata,
  };
}

async function setActor(client, actor) {
  await client.query("SELECT set_config('app.actor_id', $1, true)", [actor]);
}

async function lockedCampaign(client, id) {
  const result = await client.query("SELECT * FROM campaigns WHERE id = $1 FOR UPDATE", [id]);
  return mapCampaign(result.rows[0]);
}

export function createRepository(pool, { dispatchLockTimeoutMs = 300_000 } = {}) {
  if (!Number.isInteger(dispatchLockTimeoutMs) || dispatchLockTimeoutMs < 1000) {
    throw new TypeError("dispatchLockTimeoutMs must be an integer of at least 1000");
  }

  const repository = {
    async listSources() {
      const result = await pool.query("SELECT * FROM content_sources ORDER BY is_active DESC, name");
      return result.rows.map(mapSource);
    },

    async createSource(input, actor) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const result = await client.query(
          `INSERT INTO content_sources(name, source_type, url, category, schedule, is_active)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [input.name, input.type, input.url, input.category, input.schedule, input.active],
        );
        return mapSource(result.rows[0]);
      });
    },

    async updateSource(id, patch, actor) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const currentResult = await client.query("SELECT * FROM content_sources WHERE id = $1 FOR UPDATE", [id]);
        const current = currentResult.rows[0];
        if (!current) return null;
        const result = await client.query(
          `UPDATE content_sources SET name=$2, source_type=$3, url=$4, category=$5, schedule=$6, is_active=$7
           WHERE id=$1 RETURNING *`,
          [id, patch.name ?? current.name, patch.type ?? current.source_type, patch.url ?? current.url,
            patch.category ?? current.category, patch.schedule ?? current.schedule, patch.active ?? current.is_active],
        );
        return mapSource(result.rows[0]);
      });
    },

    async listAudiences() {
      const result = await pool.query("SELECT * FROM audiences ORDER BY is_active DESC, name");
      return result.rows.map(mapAudience);
    },

    async createAudience(input, actor) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const result = await client.query(
          `INSERT INTO audiences(name, description, recipient_count, external_key)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [input.name, input.description, input.recipientCount, input.externalKey || null],
        );
        const audience = mapAudience(result.rows[0]);
        if (input.emails?.length) {
          await client.query(
            `INSERT INTO audience_members(audience_id, email)
             SELECT $1, unnest($2::text[])
             ON CONFLICT DO NOTHING`,
            [audience.id, input.emails],
          );
          await client.query("UPDATE audiences SET recipient_count = $2 WHERE id = $1", [audience.id, input.emails.length]);
          audience.recipientCount = input.emails.length;
        }
        return audience;
      });
    },

    async listArticles() {
      const result = await pool.query("SELECT * FROM articles ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 250");
      return result.rows.map(mapArticle);
    },

    async ingestArticle(input, actor = "n8n") {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const result = await client.query(
          `INSERT INTO articles(source_id, external_key, title, summary, body, source_url, published_at, metadata, content_hash, category)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (source_id, external_key) WHERE source_id IS NOT NULL AND external_key IS NOT NULL
           DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, body=EXCLUDED.body,
             source_url=EXCLUDED.source_url, published_at=EXCLUDED.published_at,
             metadata=EXCLUDED.metadata, content_hash=EXCLUDED.content_hash,
             category=EXCLUDED.category, version=articles.version + 1
           RETURNING *`,
          [input.sourceId, input.externalKey, input.title, input.summary, input.body, input.sourceUrl,
            input.publishedAt, input.metadata, input.contentHash, input.category],
        );
        return mapArticle(result.rows[0]);
      });
    },

    async listCampaigns() {
      const result = await pool.query(`
        SELECT c.*, latest.status AS delivery_status
          FROM campaigns c
          LEFT JOIN LATERAL (
            SELECT status
              FROM outbox
             WHERE campaign_id = c.id
             ORDER BY created_at DESC
             LIMIT 1
          ) latest ON true
         ORDER BY c.updated_at DESC
      `);
      return result.rows.map(mapCampaign);
    },

    async getCampaign(id) {
      const result = await pool.query("SELECT * FROM campaigns WHERE id = $1", [id]);
      return mapCampaign(result.rows[0]);
    },

    async createCampaign(input, actor) {
      const campaign = {
        ...input,
        previewText: input.previewText ?? "",
        audienceListIds: input.audienceListIds ?? [],
      };
      const contentHash = computeCampaignHash(campaign);
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const result = await client.query(
          `INSERT INTO campaigns
             (name, subject, preview_text, html_content, audience_list_ids, status, content_hash)
           VALUES ($1, $2, $3, $4, $5, 'draft', $6)
           RETURNING *`,
          [
            campaign.name,
            campaign.subject,
            campaign.previewText,
            campaign.htmlContent,
            campaign.audienceListIds,
            contentHash,
          ],
        );
        return mapCampaign(result.rows[0]);
      });
    },

    async updateCampaign(id, patch, actor) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const current = await lockedCampaign(client, id);
        if (!current) return null;
        const updated = applyCampaignEdit(current, patch);
        if (updated === current) return current;
        const result = await client.query(
          `UPDATE campaigns
              SET name = $2,
                  subject = $3,
                  preview_text = $4,
                  html_content = $5,
                  audience_list_ids = $6,
                  content_hash = $7
            WHERE id = $1
            RETURNING *`,
          [
            id,
            updated.name,
            updated.subject,
            updated.previewText,
            updated.htmlContent,
            updated.audienceListIds,
            updated.contentHash,
          ],
        );
        return mapCampaign(result.rows[0]);
      });
    },

    async submitCampaign(id, actor) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const current = await lockedCampaign(client, id);
        if (!current) return null;
        const submitted = submitForReview(current);
        const result = await client.query(
          `UPDATE campaigns
              SET status = 'in_review', content_hash = $2, version = version + 1
            WHERE id = $1
            RETURNING *`,
          [id, submitted.contentHash],
        );
        return mapCampaign(result.rows[0]);
      });
    },

    async approveCampaign(id, actor) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const current = await lockedCampaign(client, id);
        if (!current) return null;
        const approved = approveCampaign(current, actor);
        await client.query(
          `INSERT INTO campaign_approvals(campaign_id, content_hash, decision, decided_by)
           VALUES ($1, $2, 'approved', $3)`,
          [id, approved.approvedHash, actor],
        );
        return lockedCampaign(client, id);
      });
    },

    async rejectCampaign(id, actor, reason) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const current = await lockedCampaign(client, id);
        if (!current) return null;
        const rejected = rejectCampaign(current, actor, reason);
        await client.query(
          `INSERT INTO campaign_approvals(campaign_id, content_hash, decision, decided_by, reason)
           VALUES ($1, $2, 'rejected', $3, $4)`,
          [id, rejected.contentHash, actor, rejected.rejectionReason],
        );
        return lockedCampaign(client, id);
      });
    },

    async queueCampaign(id, actor, payload = {}) {
      return withTransaction(pool, async (client) => {
        await setActor(client, actor);
        const current = await lockedCampaign(client, id);
        if (!current) return null;
        assertQueueable(current);
        const recipients = await client.query(
          `SELECT DISTINCT email FROM audience_members
            WHERE audience_id = ANY($1::integer[]) ORDER BY email`,
          [current.audienceListIds],
        );
        if (!recipients.rowCount) {
          const error = new Error("At least one recipient is required before queueing");
          error.code = "recipient_required";
          error.statusCode = 409;
          throw error;
        }
        await client.query(
          `INSERT INTO campaign_recipients(campaign_id, content_hash, email)
           SELECT $1, $2, unnest($3::text[]) ON CONFLICT DO NOTHING`,
          [id, current.approvedHash, recipients.rows.map((row) => row.email)],
        );
        const result = await client.query(
          `INSERT INTO outbox(campaign_id, content_hash, payload)
           VALUES ($1, $2, $3)
           ON CONFLICT (campaign_id, content_hash) DO NOTHING
           RETURNING *`,
          [id, current.approvedHash, payload],
        );
        if (result.rowCount) return { campaign: current, outbox: mapOutbox(result.rows[0]) };
        const existing = await client.query(
          "SELECT * FROM outbox WHERE campaign_id = $1 AND content_hash = $2",
          [id, current.approvedHash],
        );
        return { campaign: current, outbox: mapOutbox(existing.rows[0]), alreadyQueued: true };
      });
    },

    async setRemoteCampaign(id, remoteId) {
      const result = await pool.query(
        "UPDATE campaigns SET remote_campaign_id = $2 WHERE id = $1 RETURNING *",
        [id, String(remoteId)],
      );
      return mapCampaign(result.rows[0]);
    },

    async getCampaignRecipients(id, contentHash) {
      const result = await pool.query(
        "SELECT email FROM campaign_recipients WHERE campaign_id=$1 AND content_hash=$2 ORDER BY email",
        [id, contentHash],
      );
      return result.rows.map((row) => row.email);
    },
  };

  const outbox = {
    async claimNext() {
      return withTransaction(pool, async (client) => {
        const result = await client.query(`
          WITH candidate AS (
            SELECT id
              FROM outbox
             WHERE (
                    status IN ('queued', 'failed')
                    OR (status = 'dispatching' AND locked_at <= now() - make_interval(secs => $1))
                   )
               AND available_at <= now()
             ORDER BY created_at
             FOR UPDATE SKIP LOCKED
             LIMIT 1
          )
          UPDATE outbox o
             SET status = 'dispatching',
                 attempts = attempts + 1,
                 locked_at = now(),
                 last_error = NULL
            FROM candidate
           WHERE o.id = candidate.id
          RETURNING o.*
        `, [dispatchLockTimeoutMs / 1000]);
        return mapOutbox(result.rows[0]);
      });
    },

    async markDispatched(id, { remoteId } = {}) {
      const result = await pool.query(
        `UPDATE outbox
            SET status = 'dispatched', locked_at = NULL,
                payload = payload || jsonb_build_object('remoteId', $2::text)
          WHERE id = $1 AND status = 'dispatching'
          RETURNING *`,
        [id, String(remoteId)],
      );
      return mapOutbox(result.rows[0]);
    },

    async markSent(id) {
      const result = await pool.query(
        "UPDATE outbox SET status = 'sent' WHERE id = $1 AND status = 'dispatched' RETURNING *",
        [id],
      );
      return mapOutbox(result.rows[0]);
    },

    async fail(id, error) {
      const message = error instanceof Error ? error.message : String(error);
      const result = await pool.query(
        `UPDATE outbox
            SET status = 'failed', locked_at = NULL, last_error = $2,
                available_at = now() + make_interval(secs => LEAST(3600, 30 * power(2, attempts)::integer))
          WHERE id = $1 AND status IN ('dispatching', 'dispatched')
          RETURNING *`,
        [id, message.slice(0, 2000)],
      );
      return mapOutbox(result.rows[0]);
    },
  };

  return { repository, outbox };
}
