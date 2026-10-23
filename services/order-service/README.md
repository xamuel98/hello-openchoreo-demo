# Order Service

Private order API backed by PostgreSQL. It validates users through `user-service` and publishes `orders.created` events to NATS.

- Port: `8080`
- OpenChoreo application path: `/services/order-service`
- Endpoint: `http` with `project` visibility
- Dependencies: `user-service:http`, `orders-db`, `event-broker`
- Environment: `PORT`, `APP_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `USER_SERVICE_URL`, `NATS_URL`
- Routes: `GET /health`, `POST /orders`, `GET /orders`, `GET /orders/:id`

```bash
npm ci
npm test
npm start
```
