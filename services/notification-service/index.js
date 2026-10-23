const express = require("express");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function createNotification(event, now = new Date()) {
  if (event?.eventType !== "orders.created" || !Number.isInteger(event?.order?.id) || !Number.isInteger(event?.order?.userId)) {
    throw new Error("invalid orders.created event");
  }

  return {
    type: "order-created",
    orderId: event.order.id,
    message: `Order ${event.order.id} was created for user ${event.order.userId}`,
    receivedAt: now.toISOString()
  };
}

function createNotificationStore(limit = 50) {
  const notifications = [];
  return {
    add(event) {
      const notification = createNotification(event);
      notifications.unshift(notification);
      if (notifications.length > limit) notifications.length = limit;
      return notification;
    },
    list() {
      return [...notifications];
    }
  };
}

function createApp({ store }) {
  const app = express();

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });

  app.get("/notifications", (req, res) => {
    res.json(store.list());
  });

  return app;
}

async function connectSubscriber(url, store) {
  const { connect } = await import("@nats-io/transport-node");
  const connection = await connect({ servers: url });
  const subscription = connection.subscribe("orders.created");

  (async () => {
    for await (const message of subscription) {
      try {
        const event = message.json();
        console.log(`orders.created received for order ${event?.order?.id ?? "unknown"}`);
        const notification = store.add(event);
        console.log(`Notification generated for order ${notification.orderId}`);
      } catch (error) {
        console.error(`Unable to process orders.created event: ${error.message}`);
      }
    }
  })().catch((error) => console.error(`NATS subscription stopped: ${error.message}`));

  return connection;
}

async function retry(operation, label, { attempts = 10, delayMs = 3000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`${label} is not ready (attempt ${attempt}/${attempts}): ${error.message}`);
      if (attempt < attempts) await delay(delayMs);
    }
  }
  throw lastError;
}

async function start() {
  if (!process.env.NATS_URL) throw new Error("NATS_URL is required");
  const store = createNotificationStore();
  const connection = await retry(() => connectSubscriber(process.env.NATS_URL, store), "NATS");
  const app = createApp({ store });
  const port = process.env.PORT || 8080;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Notification Service running on port ${port} in ${process.env.APP_ENV || "development"}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await connection.drain();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`Notification Service failed to start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { createApp, createNotification, createNotificationStore, retry };
