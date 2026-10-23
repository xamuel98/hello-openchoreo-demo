# Hello API Technical Design Document

## Architecture

Hello API is a single-process Express application packaged as one OCI container. OpenChoreo builds the image, creates the Workload and ComponentRelease, and deploys the same release through the configured environment pipeline.

```text
Git repository
  -> OpenChoreo workflow quality gates
  -> Docker image build and publication
  -> Workload and ComponentRelease
  -> Development
  -> Staging/Test
  -> Production
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

## CI workflow design

The Dockerfile validation stage makes the existing `amp-docker` workflow enforce the quality gate immediately. A non-zero exit code stops the container build, preventing image publication and deployment.

The optional `node-quality-gates` ClusterWorkflowTemplate can additionally run after source checkout and before the container build. It executes `npm ci` followed by `npm run validate:ci` and exposes validation as a separate OpenChoreo workflow step.

The shared `amp-docker` workflow is Helm/Flux-managed. The quality gate should be composed into a separately named component workflow rather than modifying the shared workflow directly.

## Deployment and routing

The repository-level `workload.yaml` declares an external HTTP endpoint on port `8080` with base path `/`. The OpenChoreo data-plane gateway generates the external HTTPRoute. The configured gateway host is the base domain `openchoreoapis.internal`; wildcard handling belongs in DNS and TLS configuration.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Shared workflow changes affect unrelated components | Install a separately named validated workflow |
| Build workflow ignores `workload.yaml` | Use descriptor-aware workload generation and verify `FROM SOURCE: Yes` |
| Documentation becomes stale | Enforce required sections in `validate:docs` |
| Environment-specific builds drift | Promote one ComponentRelease and override `APP_ENV` per environment |
