const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { buildOrderCreatedEvent, createApp, createNatsOptions } = require("../index");

const repository = {
  async create(order) {
    return { id: 1, ...order };
  },
  async list() {
    return [];
  },
  async findById() {
    return null;
  }
};
let userExists = true;
const userClient = { async findById() { return userExists ? { id: 1 } : null; } };
const published = [];
const eventPublisher = { async publish(event) { published.push(event); } };

let server;
let baseUrl;

before(async () => {
  server = createApp({ repository, userClient, eventPublisher }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("GET /health reports healthy", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
});

test("POST /orders rejects invalid input", async () => {
  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: 1, item: "Laptop", quantity: 0 })
  });
  assert.equal(response.status, 400);
});

test("POST /orders reports a missing user", async () => {
  userExists = false;
  try {
    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: 99, item: "Laptop", quantity: 1 })
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "user_not_found" });
  } finally {
    userExists = true;
  }
});

test("order event payload contains the public order fields", () => {
  const event = buildOrderCreatedEvent(
    { id: 7, userId: 3, item: "MacBook Pro", quantity: 1, internal: "ignored" },
    new Date("2026-01-02T03:04:05.000Z")
  );
  assert.deepEqual(event, {
    eventType: "orders.created",
    order: { id: 7, userId: 3, item: "MacBook Pro", quantity: 1 },
    createdAt: "2026-01-02T03:04:05.000Z"
  });
});

test("POST /orders publishes orders.created", async () => {
  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: 1, item: "MacBook Pro", quantity: 1 })
  });
  assert.equal(response.status, 201);
  assert.equal(published.at(-1).eventType, "orders.created");
  assert.equal(published.at(-1).order.id, 1);
});

test("createNatsOptions builds token-authenticated connection options", () => {
  const options = createNatsOptions(
    "nats://example-token@nats.example.internal:4222",
    "example-token"
  );

  assert.deepEqual(options, {
    servers: "nats://nats.example.internal:4222",
    token: "example-token"
  });
});

test("createNatsOptions rejects a missing token", () => {
  assert.throws(
    () => createNatsOptions(
      "nats://example-token@nats.example.internal:4222",
      ""
    ),
    /NATS_URL and NATS_PASSWORD are required/
  );
});

test("createNatsOptions rejects invalid URL protocols", () => {
  assert.throws(
    () => createNatsOptions(
      "https://nats.example.internal:4222",
      "example-token"
    ),
    /Invalid NATS connection URL/
  );
});

test("createNatsOptions removes embedded credentials", () => {
  const options = createNatsOptions(
    "nats://username:embedded-secret@nats.example.internal:4222",
    "actual-token"
  );

  assert.deepEqual(options, {
    servers: "nats://nats.example.internal:4222",
    token: "actual-token"
  });
});