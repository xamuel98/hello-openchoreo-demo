# Hello API

A minimal Node.js and Express API for learning source-based deployments with OpenChoreo.

## Run locally

```bash
npm ci
npm start
```

The API listens on port `8080` by default. Override it with `PORT` and select the displayed environment with `APP_ENV`.

## OpenChoreo Deployment

### Component metadata

| Field | Value |
|---|---|
| Project | `hello-world-demo` |
| Component Name | `hello-api` |
| Display Name | `Hello API` |
| Description | Simple Node.js Hello World API for testing OpenChoreo deployments and environment-specific configuration. |
| Component Type | `deployment/service` |

### Source build configuration

| Field | Value |
|---|---|
| Deployment method | Build from Source |
| Repository | This repository |
| Branch | `main` |
| Application path | `/` |
| Build method/workflow | Dockerfile builder |
| Auto deploy | Enabled |

The application path is `/` because `Dockerfile`, `package.json`, `index.js`, and `workload.yaml` are all at the Git repository root.

### Runtime configuration

| Field | Value |
|---|---|
| Container port | `8080` |
| Endpoint name | `http` |
| Endpoint type | `HTTP` |
| Base path | `/` |
| Visibility | `external` |
| Health endpoint | `/health` |

### Environment configuration

| Environment | APP_ENV |
|---|---|
| Development | `development` |
| Staging/Test | `staging` |
| Production | `production` |

`development` is the default declared in `workload.yaml`. Promote the same component and build through the environments, applying `APP_ENV` values for Staging/Test and Production through OpenChoreo deployment or ReleaseBinding overrides. Do not create separate environment-specific source builds.

### Container validation

```bash
docker build -t hello-api .
docker run --rm -p 8080:8080 -e APP_ENV=development hello-api
```

After startup, `GET /` returns the service metadata and configured environment, while `GET /health` returns HTTP 200 with `{"status":"healthy"}`.

## Quality gates

Run the same checks expected by the validated OpenChoreo workflow:

```bash
npm ci
npm run validate:ci
```

The validation command checks the required README, PRD, TDD, and OpenChoreo workload content before running the API tests. The tests cover the root response, `APP_ENV` overrides, and the health endpoint.

The Dockerfile runs this gate in a dedicated `validation` stage. Consequently, the existing `amp-docker` build fails before producing the final image when a validation fails. The final image contains only production dependencies and `index.js`.

| Artifact | Purpose |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements and acceptance criteria |
| [`docs/TDD.md`](docs/TDD.md) | Technical design, test strategy, and deployment design |
| [`test/api.test.js`](test/api.test.js) | HTTP endpoint tests using Node.js's built-in test runner |
| [`scripts/validate-docs.js`](scripts/validate-docs.js) | Required-document and workload-content validation |
| [`openchoreo/workflows/node-quality-gates.yaml`](openchoreo/workflows/node-quality-gates.yaml) | Reusable workflow-plane quality-gate step |

The platform installation instructions are in [`openchoreo/workflows/README.md`](openchoreo/workflows/README.md). The optional dedicated workflow step makes the quality gate separately visible in OpenChoreo. The shared `amp-docker` workflow is Helm/Flux-managed, so that step should be installed through `amp-platform-resources` and composed into a separately named workflow such as `amp-docker-node-validated`.
