const { randomUUID } = require("node:crypto");
class JobRepository {
  constructor(db) {
    this.db = db;
  }
  create(rule, comment) {
    const now = Date.now();
    const iso = new Date(now).toISOString();
    return (
      this.db
        .prepare(
          `INSERT OR IGNORE INTO dm_jobs (id, rule_id, recipient_user_id, comment_id, message, idempotency_key, status, next_action_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          rule.id,
          comment.from.user_id,
          comment.comment_id,
          rule.dm_message,
          `rule:${rule.id}:recipient:${comment.from.user_id}`,
          now,
          iso,
          iso,
        ).changes === 1
    );
  }
  nextDue() {
    return this.db
      .prepare(
        "SELECT * FROM dm_jobs WHERE status IN ('pending', 'waiting_delivery') AND next_action_at <= ? ORDER BY next_action_at, created_at LIMIT 1",
      )
      .get(Date.now());
  }
  cancelForComment(commentId) {
    this.db
      .prepare(
        "UPDATE dm_jobs SET status = 'cancelled', last_error = ?, updated_at = ? WHERE comment_id = ? AND status = 'pending'",
      )
      .run(
        "Comment deleted before the DM was sent.",
        new Date().toISOString(),
        commentId,
      );
  }
  accepted(id, dmId, nextAt) {
    this.db
      .prepare(
        "UPDATE dm_jobs SET status = 'waiting_delivery', remote_dm_id = ?, next_action_at = ?, last_error = NULL, updated_at = ? WHERE id = ?",
      )
      .run(dmId, nextAt, new Date().toISOString(), id);
  }
  delivered(id) {
    this.db
      .prepare(
        "UPDATE dm_jobs SET status = 'delivered', updated_at = ? WHERE id = ?",
      )
      .run(new Date().toISOString(), id);
  }
  reschedule(id, attempts, delay, error) {
    this.db
      .prepare(
        "UPDATE dm_jobs SET attempt_count = ?, next_action_at = ?, last_error = ?, updated_at = ? WHERE id = ?",
      )
      .run(attempts, Date.now() + delay, error, new Date().toISOString(), id);
  }
  retryDeliveryFailure(job, attempts, delay) {
    this.db
      .prepare(
        "UPDATE dm_jobs SET status = 'pending', attempt_count = ?, idempotency_key = ?, remote_dm_id = NULL, next_action_at = ?, last_error = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        attempts,
        `${job.idempotency_key}:retry:${attempts}`,
        Date.now() + delay,
        "PseudoGram reported a failed delivery.",
        new Date().toISOString(),
        job.id,
      );
  }
  fail(id, attempts, error) {
    this.db
      .prepare(
        "UPDATE dm_jobs SET status = 'failed', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?",
      )
      .run(attempts, error, new Date().toISOString(), id);
  }
  stats() {
    const counts = this.db
      .prepare(
        "SELECT COALESCE(SUM(status = 'delivered'), 0) sent, COALESCE(SUM(status = 'failed'), 0) failed, COALESCE(SUM(status IN ('pending', 'waiting_delivery')), 0) queued FROM dm_jobs",
      )
      .get();
    return {
      ...counts,
      duplicates_blocked: this.db
        .prepare("SELECT value FROM metrics WHERE name = 'duplicates_blocked'")
        .get().value,
    };
  }
}
module.exports = { JobRepository };
