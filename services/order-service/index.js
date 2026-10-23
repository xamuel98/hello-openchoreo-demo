const express = require("express");
const { Pool } = require("pg");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function createPoolFromEnv() {
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
}

function createOrderRepository(pool) {
  return {
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          item TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    },
    async create({ userId, item, quantity }) {
      const result = await pool.query(
        `INSERT INTO orders (user_id, item, quantity)
         VALUES ($1, $2, $3)
         RETURNING id, user_id AS "userId", item, quantity, created_at AS "createdAt"`,
        [userId, item, quantity]
      );
      return result.rows[0];
    },
    async list() {
      const result = await pool.query(
        `SELECT id, user_id AS "userId", item, quantity, created_at AS "createdAt"
         FROM orders ORDER BY id`
      );
      return result.rows;
    },
    async findById(id) {
      const result = await pool.query(
        `SELECT id, user_id AS "userId", item, quantity, created_at AS "createdAt"
         FROM orders WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },
    async close() {
      await pool.end();
    }
  };
}

function createUserClient({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 5000 }) {
  return {
    async findById(id) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/users/${id}`, {
          signal: controller.signal
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`user-service returned HTTP ${response.status}`);
        return response.json();
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

function buildOrderCreatedEvent(order, now = new Date()) {
  return {
    eventType: "orders.created",
    order: {
      id: order.id,
      userId: order.userId,
      item: order.item,
      quantity: order.quantity
    },
    createdAt: now.toISOString()
  };
}

async function connectNatsPublisher(url) {
  const { connect } = await import("@nats-io/transport-node");
  const connection = await connect({ servers: url });
  return {
    async publish(event) {
      connection.publish("orders.created", JSON.stringify(event));
      await connection.flush();
    },
    async close() {
      await connection.drain();
    }
  };
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

function createApp({ repository, userClient, eventPublisher }) {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });

  app.post("/orders", async (req, res) => {
    const { userId, item, quantity } = req.body || {};
    if (!Number.isInteger(userId) || userId < 1 || typeof item !== "string" || !item.trim() || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "valid_user_id_item_and_quantity_are_required" });
    }

    try {
      const user = await userClient.findById(userId);
      if (!user) return res.status(404).json({ error: "user_not_found" });

      const order = await repository.create({ userId, item: item.trim(), quantity });
      const event = buildOrderCreatedEvent(order);
      await eventPublisher.publish(event);
      console.log(`Order created: ${order.id}`);
      console.log(`orders.created published for order ${order.id}`);
      return res.status(201).json(order);
    } catch (error) {
      console.error(`Unable to create order: ${error.message}`);
      return res.status(502).json({ error: "order_dependency_failed" });
    }
  });

  app.get("/orders", async (req, res) => {
    try {
      return res.json(await repository.list());
    } catch (error) {
      console.error(`Unable to list orders: ${error.message}`);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/orders/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "invalid_order_id" });

    try {
      const order = await repository.findById(id);
      return order ? res.json(order) : res.status(404).json({ error: "order_not_found" });
    } catch (error) {
      console.error(`Unable to read order: ${error.message}`);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  return app;
}

async function start() {
  if (!process.env.USER_SERVICE_URL || !process.env.NATS_URL) {
    throw new Error("USER_SERVICE_URL and NATS_URL are required");
  }

  const repository = createOrderRepository(createPoolFromEnv());
  await retry(() => repository.initialize(), "Order database");
  const eventPublisher = await retry(() => connectNatsPublisher(process.env.NATS_URL), "NATS");
  const userClient = createUserClient({ baseUrl: process.env.USER_SERVICE_URL });
  const app = createApp({ repository, userClient, eventPublisher });
  const port = process.env.PORT || 8080;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Order Service running on port ${port} in ${process.env.APP_ENV || "development"}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await Promise.all([repository.close(), eventPublisher.close()]);
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`Order Service failed to start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildOrderCreatedEvent,
  createApp,
  createOrderRepository,
  createUserClient,
  retry
};
