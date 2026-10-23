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

function createUserRepository(pool) {
  return {
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    },
    async create({ name, email }) {
      const result = await pool.query(
        `INSERT INTO users (name, email)
         VALUES ($1, $2)
         RETURNING id, name, email, created_at AS "createdAt"`,
        [name, email]
      );
      return result.rows[0];
    },
    async list() {
      const result = await pool.query(
        `SELECT id, name, email, created_at AS "createdAt"
         FROM users ORDER BY id`
      );
      return result.rows;
    },
    async findById(id) {
      const result = await pool.query(
        `SELECT id, name, email, created_at AS "createdAt"
         FROM users WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },
    async close() {
      await pool.end();
    }
  };
}

async function initializeWithRetry(repository, { attempts = 10, delayMs = 3000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await repository.initialize();
      console.log("User database schema is ready");
      return;
    } catch (error) {
      lastError = error;
      console.warn(`User database is not ready (attempt ${attempt}/${attempts}): ${error.message}`);
      if (attempt < attempts) await delay(delayMs);
    }
  }
  throw lastError;
}

function createApp({ repository }) {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });

  app.post("/users", async (req, res) => {
    const { name, email } = req.body || {};
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "name_and_valid_email_are_required" });
    }

    try {
      const user = await repository.create({ name: name.trim(), email: email.trim().toLowerCase() });
      console.log(`User created: ${user.id}`);
      return res.status(201).json(user);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "email_already_exists" });
      }
      console.error(`Unable to create user: ${error.message}`);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/users", async (req, res) => {
    try {
      return res.json(await repository.list());
    } catch (error) {
      console.error(`Unable to list users: ${error.message}`);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/users/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "invalid_user_id" });
    }

    try {
      const user = await repository.findById(id);
      return user ? res.json(user) : res.status(404).json({ error: "user_not_found" });
    } catch (error) {
      console.error(`Unable to read user: ${error.message}`);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  return app;
}

async function start() {
  const repository = createUserRepository(createPoolFromEnv());
  await initializeWithRetry(repository);
  const app = createApp({ repository });
  const port = process.env.PORT || 8080;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`User Service running on port ${port} in ${process.env.APP_ENV || "development"}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await repository.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`User Service failed to start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { createApp, createUserRepository, initializeWithRetry };
