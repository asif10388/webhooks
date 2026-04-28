import { createPrismaClient } from "./db.js";

const databaseUrl =
  process.env["DATABASE_URL"] || "postgresql://postgres:12345678@localhost:5432/webhook_db";

const prisma = createPrismaClient(databaseUrl);

const MAX_ATTEMPTS = 5;

function getBackoffDelay(attempts: number) {
  const delays = [0, 5000, 30000, 120000];
  return delays[Math.min(attempts, delays.length - 1)];
}

async function handleFailure(jobId: string, attempts: number) {
  const nextAttempts = attempts + 1;

  if (nextAttempts >= MAX_ATTEMPTS) {
    await prisma.webhookEvent.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        attempts: nextAttempts,
      },
    });
    return;
  }

  const delay = getBackoffDelay(nextAttempts);

  await prisma.webhookEvent.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      attempts: nextAttempts,
      nextRetryAt: new Date(Date.now() + delay),
    },
  });
}

async function processJob(job: any) {
  const claimed = await prisma.webhookEvent.updateMany({
    where: {
      id: job.id,
      status: "PENDING",
    },
    data: {
      status: "DELIVERING",
    },
  });

  if (claimed.count === 0) return;

  try {
    const sub = await prisma.webhookSubscription.findUnique({
      where: { id: job.subscriptionId },
    });

    if (!sub) {
      throw new Error("Subscription not found");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(sub.url, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify(job.payload),
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }

    await prisma.webhookEvent.update({
      where: { id: job.id },
      data: { status: "DELIVERED" },
    });
  } catch (error) {
    await handleFailure(job.id, job.attempts);
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
      orderBy: { createdAt: "asc" },
    });

    for (const job of jobs) {
      await processJob(job);
    }
  }, 2000);
}
