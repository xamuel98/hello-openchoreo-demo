
const express = require("express");

const app = express();
const port = process.env.PORT || 8080;

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Hello API running on port ${port}`);
});
