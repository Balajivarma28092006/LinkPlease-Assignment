class EventRepository {
  constructor(db) {
    this.db = db;
  }
  save(event) {
    return (
      this.db
        .prepare(
          "INSERT OR IGNORE INTO incoming_events(event_id, event_type, payload, status, received_at) VALUES (?, ?, ?, 'received', ?)",
        )
        .run(
          event.event_id,
          event.event_type,
          JSON.stringify(event),
          new Date().toISOString(),
        ).changes === 1
    );
  }
  nextUnprocessed() {
    return this.db
      .prepare(
        "SELECT * FROM incoming_events WHERE status = 'received' ORDER BY received_at LIMIT 1",
      )
      .get();
  }
  markProcessed(eventId) {
    this.db
      .prepare(
        "UPDATE incoming_events SET status = 'processed' WHERE event_id = ?",
      )
      .run(eventId);
  }
  rememberDeletedComment(commentId) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO deleted_comments(comment_id, deleted_at) VALUES (?, ?)",
      )
      .run(commentId, new Date().toISOString());
  }
  isCommentDeleted(commentId) {
    return Boolean(
      this.db
        .prepare("SELECT 1 FROM deleted_comments WHERE comment_id = ?")
        .get(commentId),
    );
  }
}
module.exports = { EventRepository };
