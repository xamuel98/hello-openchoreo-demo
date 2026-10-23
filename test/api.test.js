const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const app = require("../index");
const { createApp } = require("../index");

let baseUrl;
let server;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("GET / returns the default development service metadata", async () => {
  const previousEnvironment = process.env.APP_ENV;
  delete process.env.APP_ENV;

  try {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      message: "Hello World from OpenChoreo!",
      service: "hello-api",
      environment: "development",
      version: "1.0.0"
    });
  } finally {
    if (previousEnvironment === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousEnvironment;
    }
  }
});

test("GET / reads the environment from APP_ENV", async () => {
  const previousEnvironment = process.env.APP_ENV;
  process.env.APP_ENV = "staging";

  try {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.environment, "staging");
  } finally {
    if (previousEnvironment === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousEnvironment;
    }
  }
});

test("GET /health reports a healthy service", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "healthy" });
});

test("proxy routes report an unconfigured dependency", async () => {
  const previousUrl = process.env.USER_SERVICE_URL;
  delete process.env.USER_SERVICE_URL;

  try {
    const response = await fetch(`${baseUrl}/users`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "dependency_not_configured",
      dependency: "USER_SERVICE_URL"
    });
  } finally {
    if (previousUrl === undefined) {
      delete process.env.USER_SERVICE_URL;
    } else {
      process.env.USER_SERVICE_URL = previousUrl;
    }
  }
});

test("proxy routes forward downstream status and JSON", async () => {
  const previousUrl = process.env.USER_SERVICE_URL;
  process.env.USER_SERVICE_URL = "http://user-service";
  const calls = [];
  const proxyApp = createApp({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ id: 7, name: "Samuel" }), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    }
  });
  const proxyServer = proxyApp.listen(0, "127.0.0.1");
  await new Promise((resolve) => proxyServer.once("listening", resolve));
  const proxyAddress = proxyServer.address();

  try {
    const response = await fetch(`http://127.0.0.1:${proxyAddress.port}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Samuel", email: "samuel@example.com" })
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { id: 7, name: "Samuel" });
    assert.equal(calls[0].url, "http://user-service/users");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      name: "Samuel",
      email: "samuel@example.com"
    });
  } finally {
    await new Promise((resolve, reject) => {
      proxyServer.close((error) => (error ? reject(error) : resolve()));
    });
    if (previousUrl === undefined) {
      delete process.env.USER_SERVICE_URL;
    } else {
      process.env.USER_SERVICE_URL = previousUrl;
    }
  }
});
