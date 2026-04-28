import { randomBytes } from "crypto";
import { createPrismaClient } from "./db.js";
import { JobStatus } from "./types.js";

type EmitPayload = Record<string, any>;

const databaseUrl =
  process.env["DATABASE_URL"] || "postgresql://postgres:12345678@localhost:5432/webhook_db";

export function createWebhooks() {
  const prisma = createPrismaClient(databaseUrl);

  async function register(event: string, url: string) {
    await prisma.webhookSubscription.upsert({
      where: {
        url_eventType: {
          url,
          eventType: event,
        },
      },
      update: {},
      create: {
        eventType: event,
        url,
        secret: randomBytes(32).toString("hex"),
      },
    });
  }

  async function emit(event: string, payload: EmitPayload) {
    const subscribers = await prisma.webhookSubscription.findMany({
      where: { eventType: event },
    });

    if (subscribers.length === 0) {
      console.log(`No subscribers for event: ${event}`);
      return;
    }

    const jobs = subscribers.map((sub) => ({
      payload,
      attempts: 0,
      eventType: event,
      subscriptionId: sub.id,
      nextRetryAt: new Date(),
      status: "PENDING" as JobStatus,
    }));

    await prisma.webhookEvent.createMany({
      data: jobs,
    });
  }

  return {
    register,
    emit,
  };
}
