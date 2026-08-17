class DeliveryService {
  constructor(db, jobs, config) {
    this.db = db;
    this.jobs = jobs;
    this.config = config;
  }
  async processOne() {
    const job = this.jobs.nextDue();
    if (!job || !this.config.apiKey) return false;
    if (job.status === "pending") await this.send(job);
    else await this.checkStatus(job);
    return true;
  }
  async send(job) {
    if (!this.canSendNow())
      return this.jobs.reschedule(
        job.id,
        job.attempt_count,
        60_000,
        "Waiting for local rate limit window.",
      );
    this.db
      .prepare("INSERT INTO send_attempts(requested_at) VALUES (?)")
      .run(Date.now());
    try {
      const response = await fetch(`${this.config.pseudoGramUrl}/v1/dm/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
          "Idempotency-Key": job.idempotency_key,
        },
        body: JSON.stringify({
          recipient_user_id: job.recipient_user_id,
          message: job.message,
          comment_id: job.comment_id,
        }),
      });
      if (response.status === 202)
        return this.jobs.accepted(
          job.id,
          (await response.json()).dm_id,
          Date.now() + this.config.deliveryPollDelayMs,
        );
      if (response.status === 429)
        return this.jobs.reschedule(
          job.id,
          job.attempt_count,
          (Number(response.headers.get("retry-after")) || 60) * 1000,
          "PseudoGram rate limited this request.",
        );
      const detail = await response.text();
      if (response.status >= 400 && response.status < 500)
        return this.jobs.fail(
          job.id,
          job.attempt_count,
          `Permanent API error ${response.status}: ${detail}`,
        );
      this.retryOrFail(job, `API error ${response.status}: ${detail}`);
    } catch (error) {
      this.retryOrFail(job, `Network error: ${error.message}`);
    }
  }
  async checkStatus(job) {
    try {
      const response = await fetch(
        `${this.config.pseudoGramUrl}/v1/dm/${encodeURIComponent(job.remote_dm_id)}`,
        { headers: { "X-API-Key": this.config.apiKey } },
      );
      if (!response.ok)
        return this.jobs.reschedule(
          job.id,
          job.attempt_count,
          this.backoff(job.attempt_count),
          `Status check error ${response.status}.`,
        );
      const { status } = await response.json();
      if (status === "delivered") return this.jobs.delivered(job.id);
      if (status === "queued")
        return this.jobs.reschedule(
          job.id,
          job.attempt_count,
          this.config.deliveryPollDelayMs,
          "Waiting for delivery confirmation.",
        );
      const attempts = job.attempt_count + 1;
      if (attempts >= this.config.maxAttempts)
        return this.jobs.fail(
          job.id,
          attempts,
          "PseudoGram reported a failed delivery; retry limit reached.",
        );
      this.jobs.retryDeliveryFailure(job, attempts, this.backoff(attempts));
    } catch (error) {
      this.jobs.reschedule(
        job.id,
        job.attempt_count,
        this.backoff(job.attempt_count),
        `Status check network error: ${error.message}`,
      );
    }
  }
  canSendNow() {
    const cutoff = Date.now() - 60_000;
    this.db
      .prepare("DELETE FROM send_attempts WHERE requested_at <= ?")
      .run(cutoff);
    return (
      this.db.prepare("SELECT COUNT(*) count FROM send_attempts").get().count <
      10
    );
  }
  retryOrFail(job, error) {
    const attempts = job.attempt_count + 1;
    if (attempts >= this.config.maxAttempts)
      this.jobs.fail(job.id, attempts, `${error} Retry limit reached.`);
    else this.jobs.reschedule(job.id, attempts, this.backoff(attempts), error);
  }
  backoff(attempt) {
    return (
      Math.min(60_000, 1_000 * 2 ** Math.min(attempt, 6)) +
      Math.floor(Math.random() * 500)
    );
  }
}
module.exports = { DeliveryService };
