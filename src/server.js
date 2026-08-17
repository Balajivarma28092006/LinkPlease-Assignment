const config = require("./config");
const { createDatabase } = require("./database/database");
const { RuleRepository } = require("./repositories/rule-repository");
const { EventRepository } = require("./repositories/event-repository");
const { JobRepository } = require("./repositories/job-repository");
const { EventService } = require("./services/event-service");
const { DeliveryService } = require("./services/delivery-service");
const { QueueWorker } = require("./workers/queue-worker");
const { createApp } = require("./app");

const db = createDatabase(config.databasePath);
const rules = new RuleRepository(db);
const events = new EventRepository(db);
const jobs = new JobRepository(db);
const eventService = new EventService(db, events, rules, jobs);
const deliveryService = new DeliveryService(db, jobs, config);
const worker = new QueueWorker(
  eventService,
  deliveryService,
  config.pollIntervalMs,
);
const app = createApp({
  eventService,
  ruleRepository: rules,
  jobRepository: jobs,
  apiKey: config.apiKey,
});
const server = app.listen(config.port, () =>
  console.log(`LinkPlease server listening on port ${config.port}`),
);
worker.start();
process.on("SIGTERM", () => {
  worker.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
