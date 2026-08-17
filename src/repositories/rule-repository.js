const { randomUUID } = require("node:crypto");
class RuleRepository {
  constructor(db) {
    this.db = db;
  }
  create(keyword, dmMessage) {
    const rule = { rule_id: randomUUID(), keyword, dm_message: dmMessage };
    this.db
      .prepare(
        "INSERT INTO rules(id, keyword, normalized_keyword, dm_message, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        rule.rule_id,
        keyword,
        keyword.toLocaleLowerCase(),
        dmMessage,
        new Date().toISOString(),
      );
    return rule;
  }
  all() {
    return this.db.prepare("SELECT * FROM rules").all();
  }
}
module.exports = { RuleRepository };
