import express from "express";
import { startWorker } from "./worker.js";
import { createWebhooks } from "./webhooks.js";

const app = express();
app.use(express.json());

const webhooks = createWebhooks();

startWorker();

(async () => {
  await webhooks.register("order.placed", "http://localhost:4000/hook");
  await webhooks.emit("order.placed", { orderId: 123 });

  await webhooks.register("order.shipped", "http://localhost:4000/hook");
  await webhooks.emit("order.shipped", { orderId: 456 });
})();

app.post("/hook", (req, res) => {
  console.log("Received webhook:", req.body);
  res.sendStatus(200);
});

app.listen(4000, () => {
  console.log("Example app running on http://localhost:4000");
});
