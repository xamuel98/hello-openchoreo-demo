const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const app = require("../index");

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
