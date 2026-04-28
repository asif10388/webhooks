import { createPrismaClient } from "./db.js";

const MAX_ATTEMPTS = 5;

interface ClaimedJob {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  payload: unknown;
  eventType: string;
  nextRetryAt: Date;
  maxAttempts: number;
  subscriptionId: string;
  subscriptionUrl?: string;
  lastError: string | null;
  subscriptionSecret?: string;
}

const databaseUrl =
  process.env["DATABASE_URL"] || "postgresql://postgres:12345678@localhost:5432/webhook_db";

const prisma = createPrismaClient(databaseUrl);

function getBackoffDelay(attempts: number) {
  const delays = [0, 5000, 30000, 120000];
  return delays[Math.min(attempts, delays.length - 1)];
}

async function handleFailure(job: ClaimedJob) {
  const attempts = job.attempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    await prisma.webhookEvent.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        attempts,
      },
    });

    return;
  }

  const delay = getBackoffDelay(attempts);

  await prisma.webhookEvent.update({
    where: { id: job.id },
    data: {
      status: "PENDING",
      attempts,
      nextRetryAt: new Date(Date.now() + delay),
    },
  });
}

async function processJob(job: ClaimedJob) {
  try {
    await prisma.webhookEvent.update({
      where: { id: job.id },
      data: { status: "DELIVERING" },
    });


    const subscribers = await prisma.webhookSubscription.findMany({
      where: { eventType: job.eventType },
    });

    for (const sub of subscribers) {
      await fetch(sub.url, {
        method: "POST",
        body: JSON.stringify(job.payload),
        headers: { "Content-Type": "application/json" },
      });
    }

    await prisma.webhookEvent.update({
      where: { id: job.id },
      data: { status: "DELIVERED" },
    });
  } catch (error) {
    await handleFailure(job);
  }
}

export function startWorker() {
  setInterval(async () => {
    const now = new Date();

    const jobs = await prisma.webhookEvent.findMany({
      where: {
        status: "PENDING",
        nextRetryAt: { lte: now },
      },

      take: 5,
    });

    for (const job of jobs) await processJob(job)
    
  }, 2000);
}
