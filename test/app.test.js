const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { createDatabase } = require('../src/database/database');
const { RuleRepository } = require('../src/repositories/rule-repository');
const { EventRepository } = require('../src/repositories/event-repository');
const { JobRepository } = require('../src/repositories/job-repository');
const { EventService } = require('../src/services/event-service');

test('webhooks require a valid raw-body signature and are saved', async (t) => {
  const saved = []; const app = createApp({ apiKey: 'secret', eventService: { recordWebhook: (event) => saved.push(event) }, ruleRepository: {}, jobRepository: { stats: () => ({ sent: 0, failed: 0, queued: 0, duplicates_blocked: 0 }) } });
  const server = app.listen(0); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const body = JSON.stringify({ event_id: 'event-1', event_type: 'comment.created', data: {} });
  const signature = `sha256=${crypto.createHmac('sha256', 'secret').update(body).digest('hex')}`;
  const response = await fetch(`http://127.0.0.1:${server.address().port}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PseudoGram-Signature': signature }, body });
  assert.equal(response.status, 200); assert.equal(saved.length, 1);
});

test('the durable inbox creates one job for repeated matching comments', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'linkplease-test-'));
  const db = createDatabase(path.join(directory, 'test.sqlite'));
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const rules = new RuleRepository(db); const events = new EventRepository(db); const jobs = new JobRepository(db);
  const service = new EventService(db, events, rules, jobs);
  rules.create('PRICE', 'Here is the list.');
  const event = (eventId, commentId) => ({ event_id: eventId, event_type: 'comment.created', data: { comment_id: commentId, text: 'price please', from: { user_id: 'user-1' } } });
  service.recordWebhook(event('event-1', 'comment-1')); service.processOne();
  service.recordWebhook(event('event-2', 'comment-2')); service.processOne();
  assert.deepEqual(jobs.stats(), { sent: 0, failed: 0, queued: 1, duplicates_blocked: 1 });
});
