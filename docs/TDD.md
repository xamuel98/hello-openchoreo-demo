# Hello API Technical Design Document

## Architecture

The system contains an external Express facade and three independently built project-private services. OpenChoreo builds each source path, resolves endpoint and Resource dependencies, and deploys the resulting releases into the same project environment.

```text
External client -> hello-api
  -> user-service -> users-db
  -> order-service -> user-service
                   -> orders-db
                   -> event-broker -> notification-service
  -> notification-service
```

## API design

### `GET /`

Returns HTTP 200 and JSON service metadata:

```json
{
  "message": "Hello World from OpenChoreo!",
  "service": "hello-api",
  "environment": "development",
  "version": "1.0.0"
}
```

The `environment` value is evaluated from `APP_ENV` for every request.

### `GET /health`

Returns HTTP 200:

```json
{
  "status": "healthy"
}
```

## Runtime configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Container HTTP listening port |
| `APP_ENV` | `development` | Environment reported by the root endpoint |
| `USER_SERVICE_URL` | none | Resolved `user-service:http` address |
| `ORDER_SERVICE_URL` | none | Resolved `order-service:http` address |
| `NOTIFICATION_SERVICE_URL` | none | Resolved `notification-service:http` address |

The server binds to `0.0.0.0`. OpenChoreo supplies environment-specific `APP_ENV` overrides through deployment or ReleaseBinding configuration.

## Container design

- Validation stage: Node.js 22 Alpine, all locked dependencies, source, tests, and documents.
- Validation command: `npm run validate:ci`.
- Runtime stage: Node.js 22 Alpine with `npm ci --omit=dev`.
- Runtime user: the non-root `node` account supplied by the base image.
- Entrypoint: `npm start`.
- Exposed port: `8080`.

The runtime stage copies `index.js` from the successful validation stage. This dependency ensures the validation stage cannot be skipped by the container builder while keeping tests, documents, validation tooling, and development dependencies out of the production image.

## Test strategy

The test suite uses Node.js's built-in test runner and starts Express on an ephemeral loopback port. It verifies:

- The complete default response from `GET /`.
- Dynamic `APP_ENV=staging` behavior.
- The HTTP status and body returned by `GET /health`.

The document validator checks that README, PRD, TDD, and workload descriptor files exist and retain required deployment information. Run the complete local gate with:

```bash
npm run validate:ci
```

Each internal service has its own Node test suite. Database, HTTP, and NATS boundaries are replaced with small in-memory fakes in unit tests. `docker-compose.yml` supplies the Development-only integration topology for verifying the real PostgreSQL and NATS flow.

## CI workflow design

The Dockerfile validation stage makes the existing `amp-docker` workflow enforce the quality gate immediately. A non-zero exit code stops the container build, preventing image publication and deployment.

The internal-service Dockerfiles use the same validation-stage pattern. Shared OpenChoreo workflows remain platform-owned and are not modified by this project.

## Deployment and routing

The repository-level `workload.yaml` declares the sole external endpoint. Each service descriptor declares a project-private HTTP endpoint and its endpoint/Resource bindings. The platform generates Services, network policy, environment variables, and the external HTTPRoute; source code never constructs Kubernetes DNS names.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Shared workflow changes affect unrelated components | Install a separately named validated workflow |
| Build workflow ignores `workload.yaml` | Use descriptor-aware workload generation and verify `FROM SOURCE: Yes` |
| Documentation becomes stale | Enforce required sections in `validate:docs` |
| Environment-specific builds drift | Promote one ComponentRelease and override `APP_ENV` per environment |
| A database or broker starts slowly | Retry dependency initialization during service startup |
| A downstream HTTP service is unavailable | Bound requests with timeouts and return explicit 502/504 responses |
