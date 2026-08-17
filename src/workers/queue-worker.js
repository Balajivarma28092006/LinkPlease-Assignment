class QueueWorker {
  constructor(eventService, deliveryService, intervalMs) {
    this.eventService = eventService;
    this.deliveryService = deliveryService;
    this.intervalMs = intervalMs;
    this.busy = false;
  }
  start() {
    this.timer = setInterval(
      () => this.tick().catch(console.error),
      this.intervalMs,
    );
    this.tick().catch(console.error);
  }
  stop() {
    clearInterval(this.timer);
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      // Drain several cheap database events per tick, then make at most one network call.
      for (
        let count = 0;
        count < 50 && this.eventService.processOne();
        count += 1
      ) {}
      await this.deliveryService.processOne();
    } finally {
      this.busy = false;
    }
  }
}
module.exports = { QueueWorker };
