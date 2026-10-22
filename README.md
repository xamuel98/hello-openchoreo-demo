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
