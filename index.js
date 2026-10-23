
const express = require("express");

const DEFAULT_TIMEOUT_MS = 5000;

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function createApp({ fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const app = express();
  app.use(express.json());

  app.get("/", (req, res) => {
    res.json({
      message: "Hello World from OpenChoreo!",
      service: "hello-api",
      environment: process.env.APP_ENV || "development",
      version: "1.0.0"
    });
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });

  const proxy = (envName, targetPath) => async (req, res) => {
    const baseUrl = process.env[envName];
    if (!baseUrl) {
      return res.status(503).json({
        error: "dependency_not_configured",
        dependency: envName
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(joinUrl(baseUrl, targetPath(req)), {
        method: req.method,
        headers: req.method === "GET" ? undefined : { "content-type": "application/json" },
        body: req.method === "GET" ? undefined : JSON.stringify(req.body),
        signal: controller.signal
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return res.status(502).json({ error: "invalid_downstream_response" });
      }

      const body = await response.json();
      return res.status(response.status).json(body);
    } catch (error) {
      if (error.name === "AbortError") {
        return res.status(504).json({ error: "downstream_timeout" });
      }

      console.error(`Downstream request failed for ${envName}: ${error.message}`);
      return res.status(502).json({ error: "downstream_unavailable" });
    } finally {
      clearTimeout(timeout);
    }
  };

  app.post("/users", proxy("USER_SERVICE_URL", () => "/users"));
  app.get("/users", proxy("USER_SERVICE_URL", () => "/users"));
  app.get("/users/:id", proxy("USER_SERVICE_URL", (req) => `/users/${encodeURIComponent(req.params.id)}`));

  app.post("/orders", proxy("ORDER_SERVICE_URL", () => "/orders"));
  app.get("/orders", proxy("ORDER_SERVICE_URL", () => "/orders"));
  app.get("/orders/:id", proxy("ORDER_SERVICE_URL", (req) => `/orders/${encodeURIComponent(req.params.id)}`));

  app.get("/notifications", proxy("NOTIFICATION_SERVICE_URL", () => "/notifications"));

  return app;
}

const app = createApp();

if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Hello API running on port ${port}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
