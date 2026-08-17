class EventService {
  constructor(db, events, rules, jobs) {
    this.db = db;
    this.events = events;
    this.rules = rules;
    this.jobs = jobs;
  }
  recordWebhook(event) {
    const wasSaved = this.events.save(event);
    if (!wasSaved)
      this.db
        .prepare(
          "UPDATE metrics SET value = value + 1 WHERE name = 'duplicates_blocked'",
        )
        .run();
    return wasSaved;
  }
  processOne() {
    const stored = this.events.nextUnprocessed();
    if (!stored) return false;
    const event = JSON.parse(stored.payload);
    const process = this.db.transaction(() => {
      if (event.event_type === "comment.deleted" && event.data?.comment_id) {
        this.events.rememberDeletedComment(event.data.comment_id);
        this.jobs.cancelForComment(event.data.comment_id);
      }
      if (event.event_type === "comment.created") this.createJobs(event.data);
      this.events.markProcessed(event.event_id);
    });
    process();
    return true;
  }
  createJobs(comment) {
    if (
      !comment?.comment_id ||
      !comment?.from?.user_id ||
      typeof comment.text !== "string"
    )
      return;
    if (this.events.isCommentDeleted(comment.comment_id)) return;
    const text = comment.text.toLocaleLowerCase();
    for (const rule of this.rules.all()) {
      if (!text.includes(rule.normalized_keyword)) continue;
      if (!this.jobs.create(rule, comment))
        this.db
          .prepare(
            "UPDATE metrics SET value = value + 1 WHERE name = 'duplicates_blocked'",
          )
          .run();
    }
  }
}
module.exports = { EventService };
