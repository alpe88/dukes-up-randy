const fs = require("fs");
const path = require("path");

const DEFAULT_PROVIDER_CONFIG = {
  name: "cursor",
  base_url: "https://api.cursor.com",
  launch_endpoint: "/v0/agents",
  api_key_env: "CURSOR_API_KEY",
  method: "POST",
  headers: {
    Authorization: "Basic ${basic_auth}",
    "Content-Type": "application/json",
  },
  body: {
    prompt: {
      text: "${prompt}",
    },
    model: "${model}",
    source: {
      repository: "${repository}",
      ref: "${ref}",
      prUrl: "${pr_url}",
    },
    target: {
      autoCreatePr: "${auto_create_pr}",
      openAsCursorGithubApp: "${open_as_cursor_github_app}",
      skipReviewerRequest: "${skip_reviewer_request}",
      branchName: "${branch_name}",
      autoBranch: "${auto_branch}",
    },
    webhook: {
      url: "${webhook_url}",
      secret: "${webhook_secret}",
    },
  },
};

function loadProviderConfig(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Provider config not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${resolved}: ${error.message}`);
  }
  return parsed;
}

function hasPlaceholder(value) {
  return typeof value === "string" && value.includes("<") && value.includes(">");
}

function validateProviderConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Provider config must be a JSON object.");
  }
  if (!config.base_url || hasPlaceholder(config.base_url)) {
    throw new Error("Provider config must set a valid base_url.");
  }
  if (!config.launch_endpoint || hasPlaceholder(config.launch_endpoint)) {
    throw new Error("Provider config must set a valid launch_endpoint.");
  }
  return config;
}

function resolveProviderConfig({
  provider,
  providerConfig,
  baseUrl,
  endpoint,
} = {}) {
  let config;
  if (providerConfig) {
    config = loadProviderConfig(providerConfig);
  } else if (!provider || provider === "cursor") {
    config = { ...DEFAULT_PROVIDER_CONFIG };
  } else {
    throw new Error(
      `Unsupported provider "${provider}". Provide --provider-config instead.`
    );
  }

  if (!config.name) {
    config.name = provider || "custom";
  }
  if (baseUrl) {
    config.base_url = baseUrl;
  }
  if (endpoint) {
    config.launch_endpoint = endpoint;
  }

  return validateProviderConfig(config);
}

function resolveApiKey(apiKey, config) {
  if (apiKey) {
    return apiKey;
  }
  const envName = config.api_key_env || "CURSOR_API_KEY";
  const fromEnv = process.env[envName];
  if (!fromEnv) {
    throw new Error(
      `Missing API key. Set --api-key or ${envName} in the environment.`
    );
  }
  return fromEnv;
}

function applyTemplate(value, context, missing = new Set()) {
  if (typeof value === "string") {
    const replaced = value.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const lookup = key.trim();
      const replacement = context[lookup];
      if (replacement === undefined || replacement === null) {
        missing.add(lookup);
        return "";
      }
      return String(replacement);
    });
    return { value: replaced, missing };
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => applyTemplate(item, context, missing).value);
    return { value: items, missing };
  }
  if (value && typeof value === "object") {
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = applyTemplate(entry, context, missing).value;
    });
    return { value: result, missing };
  }
  return { value, missing };
}

function pruneEmpty(value) {
  if (Array.isArray(value)) {
    const next = value
      .map((item) => pruneEmpty(item))
      .filter((item) => item !== undefined);
    return next.length ? next : undefined;
  }
  if (value && typeof value === "object") {
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      const pruned = pruneEmpty(entry);
      if (pruned !== undefined) {
        result[key] = pruned;
      }
    });
    return Object.keys(result).length ? result : undefined;
  }
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

function coerceBooleanFields(body, paths) {
  if (!body || typeof body !== "object") {
    return;
  }
  paths.forEach((path) => {
    let current = body;
    for (let i = 0; i < path.length - 1; i += 1) {
      if (!current || typeof current !== "object") {
        return;
      }
      current = current[path[i]];
    }
    if (!current || typeof current !== "object") {
      return;
    }
    const key = path[path.length - 1];
    const value = current[key];
    if (typeof value !== "string") {
      return;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      current[key] = true;
    } else if (normalized === "false") {
      current[key] = false;
    }
  });
}

function buildLaunchRequest(config, context) {
  let url;
  try {
    url = new URL(config.launch_endpoint, config.base_url).toString();
  } catch (error) {
    throw new Error(
      `Invalid provider URL. base_url="${config.base_url}", ` +
        `launch_endpoint="${config.launch_endpoint}". ${error.message}`
    );
  }
  const missing = new Set();
  const headers = applyTemplate(config.headers || {}, context, missing).value;
  const body = applyTemplate(config.body || {}, context, missing).value;
  const method = (config.method || "POST").toUpperCase();
  const prunedBody = pruneEmpty(body) || {};
  if (config.name === "cursor") {
    coerceBooleanFields(prunedBody, [
      ["target", "autoCreatePr"],
      ["target", "openAsCursorGithubApp"],
      ["target", "skipReviewerRequest"],
      ["target", "autoBranch"],
    ]);
  }
  return { url, method, headers, body: prunedBody, missing };
}

function redactHeaders(headers) {
  const sanitized = { ...headers };
  Object.keys(sanitized).forEach((key) => {
    if (/authorization/i.test(key) || /api-key/i.test(key)) {
      sanitized[key] = "***";
    }
  });
  return sanitized;
}

async function sendLaunchRequest(request) {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  const text = await response.text();
  let data = text;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }
  if (!response.ok) {
    const detail =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    throw new Error(`Provider error ${response.status}: ${detail}`);
  }
  return data;
}

module.exports = {
  DEFAULT_PROVIDER_CONFIG,
  loadProviderConfig,
  resolveProviderConfig,
  resolveApiKey,
  buildLaunchRequest,
  redactHeaders,
  sendLaunchRequest,
};
