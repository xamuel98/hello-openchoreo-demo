const fs = require("node:fs");
const path = require("node:path");
const { parseDocument } = require("yaml");

const repositoryRoot = path.resolve(__dirname, "..");

const requirements = [
  {
    file: "README.md",
    patterns: [
      /^# Hello API$/m,
      /^## OpenChoreo Deployment$/m,
      /^## Quality gates$/m
    ]
  },
  {
    file: "docs/PRD.md",
    patterns: [
      /^# Hello API Product Requirements Document$/m,
      /^## Functional requirements$/m,
      /^## Acceptance criteria$/m
    ]
  },
  {
    file: "docs/TDD.md",
    patterns: [
      /^# Hello API Technical Design Document$/m,
      /^## API design$/m,
      /^## Test strategy$/m
    ]
  }
];

const failures = [];

for (const requirement of requirements) {
  const absolutePath = path.join(repositoryRoot, requirement.file);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`${requirement.file}: file is missing`);
    continue;
  }

  const contents = fs.readFileSync(absolutePath, "utf8");
  for (const pattern of requirement.patterns) {
    if (!pattern.test(contents)) {
      failures.push(`${requirement.file}: missing required content matching ${pattern}`);
    }
  }
}

function parseYaml(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: file is missing`);
    return undefined;
  }

  const document = parseDocument(fs.readFileSync(absolutePath, "utf8"));
  if (document.errors.length > 0) {
    for (const error of document.errors) {
      failures.push(`${relativePath}: ${error.message}`);
    }
    return undefined;
  }

  return document.toJS();
}

const workload = parseYaml("workload.yaml");
if (workload) {
  const httpEndpoint = workload.endpoints?.find((endpoint) => endpoint.name === "http");
  const appEnvironment = workload.configurations?.env?.find(
    (variable) => variable.name === "APP_ENV"
  );

  if (workload.apiVersion !== "openchoreo.dev/v1alpha1") {
    failures.push("workload.yaml: apiVersion must be openchoreo.dev/v1alpha1");
  }
  if (workload.metadata?.name !== "hello-api") {
    failures.push("workload.yaml: metadata.name must be hello-api");
  }
  if (!httpEndpoint) {
    failures.push("workload.yaml: the http endpoint is missing");
  } else {
    if (httpEndpoint.type !== "HTTP") {
      failures.push("workload.yaml: the http endpoint type must be HTTP");
    }
    if (httpEndpoint.port !== 8080) {
      failures.push("workload.yaml: the http endpoint port must be 8080");
    }
    if (httpEndpoint.basePath !== "/") {
      failures.push("workload.yaml: the http endpoint basePath must be /");
    }
    if (!httpEndpoint.visibility?.includes("external")) {
      failures.push("workload.yaml: the http endpoint must include external visibility");
    }
  }
  if (appEnvironment?.value !== "development") {
    failures.push("workload.yaml: APP_ENV must default to development");
  }
}

const workflowTemplate = parseYaml("openchoreo/workflows/node-quality-gates.yaml");
if (workflowTemplate) {
  const validateTemplate = workflowTemplate.spec?.templates?.find(
    (template) => template.name === "validate"
  );
  const script = validateTemplate?.container?.args?.join("\n") || "";
  const workspaceMount = validateTemplate?.container?.volumeMounts?.find(
    (mount) => mount.name === "workspace"
  );

  if (workflowTemplate.kind !== "ClusterWorkflowTemplate") {
    failures.push(
      "openchoreo/workflows/node-quality-gates.yaml: kind must be ClusterWorkflowTemplate"
    );
  }
  if (workflowTemplate.metadata?.name !== "node-quality-gates") {
    failures.push(
      "openchoreo/workflows/node-quality-gates.yaml: metadata.name must be node-quality-gates"
    );
  }
  if (!validateTemplate) {
    failures.push(
      "openchoreo/workflows/node-quality-gates.yaml: validate template is missing"
    );
  } else {
    if (!script.includes("npm ci") || !script.includes("npm run validate:ci")) {
      failures.push(
        "openchoreo/workflows/node-quality-gates.yaml: validate step must run npm ci and npm run validate:ci"
      );
    }
    if (workspaceMount?.mountPath !== "/mnt/vol") {
      failures.push(
        "openchoreo/workflows/node-quality-gates.yaml: workspace must be mounted at /mnt/vol"
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Documentation validation passed.");
