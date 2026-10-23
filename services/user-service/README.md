# User Service

Private user-management API backed by PostgreSQL.

- Port: `8080`
- OpenChoreo application path: `/services/user-service`
- Endpoint: `http` with `project` visibility
- Resource dependency: `users-db`
- Environment: `PORT`, `APP_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Routes: `GET /health`, `POST /users`, `GET /users`, `GET /users/:id`

```bash
npm ci
npm test
npm start
```
