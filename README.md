# Webhook Delivery Library

A lightweight TypeScript library for reliably delivering webhook events to registered subscribers.

Designed for simplicity, durability, and clear delivery guarantees.

---

## ✨ Features

- Non-blocking event emission
- Persistent delivery queue (SQLite via Prisma)
- At-least-once delivery guarantee
- Automatic retries with backoff
- Background worker for async processing
- Idempotent subscription registration

---

## 📦 Installation

```bash
npm install
npx prisma migrate dev

```
```bash
import { createWebhooks } from "./lib/webhooks";
import { startWorker } from "./worker/worker";

const webhooks = createWebhooks();

// Register a subscriber
await webhooks.register("order.created", "http://localhost:4000/hook");

// Emit an event
await webhooks.emit("order.created", { orderId: 123 });

// Start background worker
startWorker();
```

Run the example:

npm run dev

This will:

Start an Express server on http://localhost:4000
Register a webhook subscriber
Emit an event
Deliver the webhook via the worker

You should see:

Received webhook: { orderId: 123 }

1. Register

Stores a subscriber URL for a given event.

2. Emit
Finds all subscribers for the event
Creates delivery jobs in the database
Returns immediately (non-blocking)

3. Worker
Polls pending jobs
Sends HTTP POST requests to subscribers
Retries failed deliveries with backoff

Delivery Guarantees

This system provides:

At-least-once delivery
Webhooks may be delivered more than once but will not be silently lost.
Durability
Jobs are persisted in the database before delivery, ensuring they survive server restarts.
Retry mechanism
Failed deliveries are retried with exponential backoff.
Non-blocking emit
Slow or failing subscribers do not affect the caller.

This implementation uses a polling-based worker to process jobs.

With more time, I would:

Replace polling with an event-driven queue (e.g., Redis + BullMQ or database notifications)
Improve concurrency handling across multiple workers
Add deduplication and stronger idempotency guarantees for delivery
Introduce monitoring and observability (metrics, logs, alerts)