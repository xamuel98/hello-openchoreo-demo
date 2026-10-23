# OpenChoreo Node.js quality gate

`node-quality-gates.yaml` defines a reusable Argo `ClusterWorkflowTemplate` that runs the repository's complete validation command against the source checked out by OpenChoreo.

The repository Dockerfile already runs the same checks in its `validation` stage, so the current `amp-docker` workflow is gated without this platform resource. Installing this template is an optional improvement that gives tests and documentation validation their own visible workflow step and fails earlier, before container build setup.

## Installation ownership

The existing `amp-docker` workflow is managed by the `amp-platform-resources` Helm release and Flux. Add this template to that platform configuration source rather than applying an untracked live edit.

Install the template in the workflow-plane cluster using the same GitOps or Helm release that manages the other `ClusterWorkflowTemplate` resources.

## Workflow composition

Create a separately named OpenChoreo component workflow, such as `amp-docker-node-validated`, based on the installed and version-compatible `amp-docker` definition. Insert this step immediately after `checkout-source` and before the container build:

```yaml
- - name: node-quality-gates
    templateRef:
      name: node-quality-gates
      template: validate
      clusterScope: true
    arguments:
      parameters:
        - name: app-path
          value: "{{workflow.parameters.app-path}}"
```

The parent Argo Workflow must retain the existing `workspace` volume mounted by the checkout and build templates. The template expects checked-out source under `/mnt/vol/source`.

After installing the new workflow:

1. Add it to the `deployment/service` ComponentType's `allowedWorkflows` list when required by the installed OpenChoreo version.
2. Change `hello-api` to use `amp-docker-node-validated` with application path `/`.
3. Preserve the existing repository, Docker context, Dockerfile, auto-deploy, and endpoint parameters.
4. Trigger a build and verify `node-quality-gates` appears between checkout and container build.
5. Confirm a deliberately failing test prevents image publication and deployment.

The custom workflow should also use descriptor-aware workload generation so repository-root `workload.yaml` produces `FROM SOURCE: Yes`.
