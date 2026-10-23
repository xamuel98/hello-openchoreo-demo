# Notification Service

Private NATS consumer that stores the most recent 50 order notifications in memory and exposes them for demo verification.

- Port: `8080`
- OpenChoreo application path: `/services/notification-service`
- Endpoint: `http` with `project` visibility
- Resource dependency: `event-broker`
- Environment: `PORT`, `APP_ENV`, `NATS_URL`
- Routes: `GET /health`, `GET /notifications`
- Subscription: `orders.created`

```bash
npm ci
npm test
npm start
```
