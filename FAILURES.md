# Known limitations and failure modes

- This uses one SQLite database and one worker process. If two deployments use different database files, both can create a job for the same user and rule, resulting in a duplicate DM. Run one instance with one persistent disk; a scaled version should use a shared database such as PostgreSQL.

- A host crash can interrupt an in-flight HTTP request after PseudoGram has received it but before this app records the response. The stable idempotency key prevents a second DM when that job retries, but this depends on PseudoGram retaining idempotency keys as documented.

- The system gives up after eight delivery/send attempts by default. A long PseudoGram outage can therefore leave a job in `failed`; it is reported honestly in `/stats`, but no automatic infinite retry exists.

- If a comment is deleted after PseudoGram has accepted the DM, the DM cannot be retracted. Only jobs that are still pending are cancelled.

- `duplicates_blocked` is a durable counter rather than a recomputed audit log. Restoring an old database backup can make it lower than the number of duplicates actually blocked before that restore.

- The local rate limiter only sees send requests made by this service. Another program using the same API key can consume the PseudoGram rate limit first. This service honours the resulting 429 and retries, but cannot predict that external usage.
