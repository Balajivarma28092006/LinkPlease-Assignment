const crypto = require("node:crypto");
const express = require("express");

function signatureIsValid(rawBody, signature, apiKey) {
  if (!apiKey) return true; // Development mode only; production must set PSEUDOGRAM_API_KEY.
  if (typeof signature !== "string" || !signature.startsWith("sha256="))
    return false;
  const expected = Buffer.from(
    `sha256=${crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex")}`,
  );
  const received = Buffer.from(signature);
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

function createApp({ eventService, ruleRepository, jobRepository, apiKey }) {
  const app = express();
  app.post(
    "/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    (request, response) => {
      if (
        !signatureIsValid(
          request.body,
          request.get("X-PseudoGram-Signature"),
          apiKey,
        )
      )
        return response.status(401).json({ error: "invalid signature" });
      let event;
      try {
        event = JSON.parse(request.body.toString("utf8"));
      } catch {
        return response.status(400).json({ error: "invalid JSON" });
      }
      if (!event.event_id || !event.event_type)
        return response
          .status(400)
          .json({ error: "event_id and event_type are required" });
      eventService.recordWebhook(event); // Durable inbox write only; workers perform the real work.
      return response.status(200).json({ ok: true });
    },
  );
  app.use(express.json({ limit: "1mb" }));
  app.post("/rules", (request, response) => {
    const keyword =
      typeof request.body.keyword === "string"
        ? request.body.keyword.trim()
        : "";
    const message =
      typeof request.body.dm_message === "string"
        ? request.body.dm_message.trim()
        : "";
    if (!keyword || !message)
      return response
        .status(400)
        .json({ error: "keyword and dm_message must be non-empty strings" });
    return response.status(201).json(ruleRepository.create(keyword, message));
  });
  app.get("/stats", (_request, response) =>
    response.json(jobRepository.stats()),
  );
  app.use((_request, response) =>
    response.status(404).json({ error: "not found" }),
  );
  return app;
}
module.exports = { createApp, signatureIsValid };
