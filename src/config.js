require("dotenv").config();

function positiveNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

module.exports = {
  port: positiveNumber("PORT", 3000),
  databasePath: process.env.DATABASE_PATH || "./data/linkplease.sqlite",
  pseudoGramUrl: (
    process.env.PSEUDOGRAM_BASE_URL || "https://pseudogram-api.onrender.com"
  ).replace(/\/$/, ""),
  apiKey: process.env.PSEUDOGRAM_API_KEY || "",
  pollIntervalMs: positiveNumber("WORKER_POLL_INTERVAL_MS", 250),
  deliveryPollDelayMs: positiveNumber("DELIVERY_POLL_DELAY_MS", 3_000),
  maxAttempts: positiveNumber("MAX_DELIVERY_ATTEMPTS", 8),
};
