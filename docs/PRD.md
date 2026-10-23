# Hello API Product Requirements Document

## Purpose

Hello API is a deliberately small Node.js service used to demonstrate the OpenChoreo source-build, release, deployment, and environment-promotion lifecycle.

## Users

- Developers learning how an application is onboarded to OpenChoreo.
- Platform engineers validating build, workload, gateway, and promotion configuration.
- Reviewers demonstrating the delivery flow from Git source to a running environment.

## Functional requirements

1. `GET /` must return HTTP 200 with the message, service name, application environment, and version.
2. `GET /health` must return HTTP 200 with `{ "status": "healthy" }`.
3. The service must read its displayed environment from `APP_ENV` and default to `development`.
4. The service must read its listening port from `PORT` and default to `8080`.
5. The service must listen on `0.0.0.0` for container and Kubernetes networking.
6. The same source and container image must support Development, Staging/Test, and Production.

## Deployment requirements

- OpenChoreo project: `hello-world-demo`.
- Component: `hello-api` (`deployment/service`).
- Source branch: `main`.
- Application path: `/`.
- Build method: Dockerfile-based source build.
- Endpoint: external HTTP on port `8080`, base path `/`.
- Default configuration: `APP_ENV=development`.

## Quality requirements

- CI must install dependencies reproducibly with `npm ci`.
- CI must validate the required project documentation and workload descriptor.
- CI must run API tests before building and publishing the container image.
- A failed quality gate must prevent publication and automatic deployment.

## Acceptance criteria

- All commands in `npm run validate:ci` succeed.
- `GET /` returns the configured `APP_ENV` value.
- `GET /health` returns the documented healthy response.
- A Docker image can start as a non-root user and serve traffic on port `8080`.
- A successful OpenChoreo workflow generates a Workload and deployable ComponentRelease.
- Environment promotion changes configuration through OpenChoreo overrides, not separate source builds.

## Non-goals

- User authentication, persistent storage, databases, background workers, or a frontend.
- Separate application builds for each environment.
- Production-scale performance or resilience testing.
