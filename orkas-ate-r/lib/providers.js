const fs = require("fs");
const path = require("path");

const DEFAULT_PROVIDER_CONFIG = {
  name: "cursor",
  base_url: "https://cursor.com",
  launch_endpoint: "",
  api_key_env: "CURSOR_API_KEY",
  method: "POST",
  headers: {
    Authorization: "Bearer ${api_key}",
    "Content-Type": "application/json",
  },
  body: {
    prompt: "${prompt}",
    metadata: {
      plan_title: "${plan_title}",
      task_id: "${task_id}",
      task_name: "${task_name}",
      subtask_id: "${subtask_id}",
      subtask_goal: "${subtask_goal}",
      agent_name: "${agent_name}",
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

function applyTemplate(value, context) {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const replacement = context[key.trim()];
      if (replacement === undefined || replacement === null) {
        return "";
      }
      return String(replacement);
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyTemplate(item, context));
  }
  if (value && typeof value === "object") {
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = applyTemplate(entry, context);
    });
    return result;
  }
  return value;
}

function buildLaunchRequest(config, context) {
  const url = new URL(config.launch_endpoint, config.base_url).toString();
  const headers = applyTemplate(config.headers || {}, context);
  const body = applyTemplate(config.body || {}, context);
  const method = (config.method || "POST").toUpperCase();
  return { url, method, headers, body };
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
