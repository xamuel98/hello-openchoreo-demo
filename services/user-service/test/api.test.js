const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp } = require("../index");

const users = [];
const repository = {
  async create(user) {
    const created = { id: users.length + 1, ...user };
    users.push(created);
    return created;
  },
  async list() {
    return users;
  },
  async findById(id) {
    return users.find((user) => user.id === id) || null;
  }
};

let server;
let baseUrl;

before(async () => {
  server = createApp({ repository }).listen(0, "127.0.0.1");
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

test("POST /users validates input", async () => {
  const response = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Samuel" })
  });
  assert.equal(response.status, 400);
});

test("POST /users creates a user", async () => {
  const response = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Samuel", email: "Samuel@Example.com" })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    id: 1,
    name: "Samuel",
    email: "samuel@example.com"
  });
});

test("GET /users/:id reports a missing user", async () => {
  const response = await fetch(`${baseUrl}/users/999`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "user_not_found" });
});
