const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp, createNotification, createNotificationStore, createNatsOptions } = require("../index");

const store = createNotificationStore();
let server;
let baseUrl;

before(async () => {
  server = createApp({ store }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("GET /health reports healthy", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "healthy" });
});

test("orders.created is converted into a notification", () => {
  const notification = createNotification(
    { eventType: "orders.created", order: { id: 4, userId: 2 } },
    new Date("2026-01-02T03:04:05.000Z")
  );
  assert.deepEqual(notification, {
    type: "order-created",
    orderId: 4,
    message: "Order 4 was created for user 2",
    receivedAt: "2026-01-02T03:04:05.000Z"
  });
});

test("invalid events are rejected", () => {
  assert.throws(() => createNotification({ eventType: "other" }), /invalid orders.created event/);
});

test("GET /notifications lists stored notifications", async () => {
  store.add({ eventType: "orders.created", order: { id: 5, userId: 3 } });
  const response = await fetch(`${baseUrl}/notifications`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body[0].orderId, 5);
});

test("the store keeps only the newest 50 notifications", () => {
  const limitedStore = createNotificationStore(50);
  for (let id = 1; id <= 55; id += 1) {
    limitedStore.add({ eventType: "orders.created", order: { id, userId: 1 } });
  }
  assert.equal(limitedStore.list().length, 50);
  assert.equal(limitedStore.list()[0].orderId, 55);
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