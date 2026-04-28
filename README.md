# Webhook Delivery Library

A lightweight TypeScript library for reliably delivering webhook events to registered subscribers. Designed for simplicity, durability, and clear delivery guarantees.

---

## Features

- **Non-blocking emission** — `emit()` returns immediately; HTTP delivery happens in the background
- **Durable queue** — delivery jobs are persisted in the database before `emit()` returns
- **At-least-once delivery** — jobs survive server restarts and are retried after crashes
- **Automatic retries** — exponential backoff on failed deliveries
- **In-process worker** — no separate process or infrastructure required
- **Idempotent registration** — re-registering the same `(eventType, url)` pair is safe

---

## Getting Started

### 1. Install dependencies and run migrations

```bash
npm install
npx prisma migrate dev
```

### 2. Use the library

```ts
import { createWebhooks } from "./lib/webhooks";

const webhooks = createWebhooks();

// Register a subscriber
await webhooks.register("order.created", "http://localhost:4000/hook");

// Emit an event — returns immediately
await webhooks.emit("order.created", { orderId: 123 });
```

### 3. Run the example

```bash
npm run dev
```

This will:

1. Start an Express server on `http://localhost:4000`
2. Register a webhook subscriber
3. Emit an event
4. Deliver the webhook via the background worker

Expected output:

```
Received webhook: { orderId: 123 }
```

---

## How It Works

### `register(eventType, url)`

Stores a subscriber URL for a given event type. Idempotent — calling it again with the same arguments reactivates the subscription without creating a duplicate.

### `emit(eventType, payload)`

1. Finds all active subscribers for the event type
2. Creates one delivery job per subscriber in the database
3. Returns immediately — no HTTP calls are made at this point

### Worker

Runs in the background on a configurable poll interval:

1. Claims a batch of pending jobs atomically (prevents double-delivery across instances)
2. Sends an HTTP `POST` to each subscriber URL concurrently
3. Marks successful deliveries as `DELIVERED`
4. Retries failed deliveries with exponential backoff
5. Marks jobs as `FAILED` after the maximum number of attempts is exhausted

---

## Delivery Guarantees

| Guarantee | Detail |
|---|---|
| **At-least-once** | Webhooks may be delivered more than once but will never be silently lost |
| **Durability** | Jobs are written to the database before `emit()` returns — survives restarts |
| **Retry with backoff** | Failed deliveries are retried at 30 s → 5 min → 30 min → 2 h intervals |
| **Non-blocking** | Slow or failing subscribers have no impact on the `emit()` caller |

---

## Future Improvements

- Replace polling with an event-driven queue (e.g., Redis + BullMQ or PostgreSQL `LISTEN/NOTIFY`)
- Stronger idempotency guarantees and deduplication on the subscriber side
- Concurrency safety across multiple worker instances
- Monitoring and observability (delivery metrics, failure alerts, a status dashboard)
