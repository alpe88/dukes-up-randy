#!/usr/bin/env node

const { program } = require("commander");
const packageJson = require("./package.json");
const {
  DEFAULT_PLAN_FILE,
  DEFAULT_TEMPLATE_FILE,
  createPlanFromPrompt,
  createTemplatePlan,
  writeJsonFile,
  loadPlanFile,
} = require("./lib/plan");
const {
  buildAgentEntries,
  buildAgentName,
  buildAgentPrompt,
} = require("./lib/agents");
const {
  resolveProviderConfig,
  resolveApiKey,
  buildLaunchRequest,
  redactHeaders,
  sendLaunchRequest,
} = require("./lib/providers");

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function parseBoolean(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`Expected "true" or "false", received "${value}".`);
}

program
  .name("oar")
  .description("Generate task plans and launch cloud agents")
  .version(packageJson.version)
  .showHelpAfterError();

program
  .command("plan")
  .description("Generate a plan JSON file from a prompt")
  .argument("<prompt...>", "Human-readable prompt")
  .option("-o, --out <path>", "Output plan path", DEFAULT_PLAN_FILE)
  .option("--force", "Overwrite the plan file if it exists")
  .action((promptParts, options) => {
    const prompt = promptParts.join(" ").trim();
    if (!prompt) {
      exitWithError("Prompt must contain non-whitespace characters.");
    }
    try {
      const plan = createPlanFromPrompt(prompt);
      const outputPath = writeJsonFile(options.out, plan, {
        force: options.force,
      });
      console.log(`Plan saved to ${outputPath}`);
    } catch (error) {
      exitWithError(error.message);
    }
  });

program
  .command("template")
  .description("Write a template plan JSON file")
  .option("-o, --out <path>", "Output template path", DEFAULT_TEMPLATE_FILE)
  .option("--force", "Overwrite the template file if it exists")
  .option("--stdout", "Print the template to stdout")
  .action((options) => {
    const template = createTemplatePlan();
    if (options.stdout) {
      console.log(JSON.stringify(template, null, 2));
      return;
    }
    try {
      const outputPath = writeJsonFile(options.out, template, {
        force: options.force,
      });
      console.log(`Template saved to ${outputPath}`);
    } catch (error) {
      exitWithError(error.message);
    }
  });

program
  .command("launch")
  .description("Launch cloud agents for each task or subtask")
  .option("-p, --plan <path>", "Path to the plan JSON", DEFAULT_PLAN_FILE)
  .option(
    "--mode <mode>",
    "Launch mode: group (task) or subtask",
    "group"
  )
  .option("--provider <name>", "Cloud provider name", "cursor")
  .option("--provider-config <path>", "Path to provider config JSON")
  .option("--api-key <key>", "API key for the provider")
  .option("--repo <url>", "Repository URL for Cursor source.repository")
  .option("--ref <ref>", "Git ref for Cursor source.ref")
  .option("--pr-url <url>", "Pull request URL for Cursor source.prUrl")
  .option("--model <name>", "Model to use for the Cursor agent")
  .option("--auto-create-pr", "Cursor target.autoCreatePr")
  .option("--open-as-cursor-github-app", "Cursor target.openAsCursorGithubApp")
  .option("--skip-reviewer-request", "Cursor target.skipReviewerRequest")
  .option("--branch-name <name>", "Cursor target.branchName")
  .option(
    "--auto-branch <bool>",
    "Cursor target.autoBranch (true/false)",
    parseBoolean
  )
  .option("--webhook-url <url>", "Cursor webhook.url")
  .option("--webhook-secret <secret>", "Cursor webhook.secret (min 32 chars)")
  .option("--continue-on-error", "Continue launching even if one fails")
  .option("--base-url <url>", "Override provider base URL")
  .option("--endpoint <path>", "Override provider launch endpoint")
  .option("--dry-run", "Print requests without sending them")
  .action(async (options) => {
    try {
      const { plan } = loadPlanFile(options.plan);
      const rawMode = options.mode;
      if (rawMode !== "group" && rawMode !== "subtask") {
        exitWithError(`Invalid mode "${rawMode}". Expected "group" or "subtask".`);
      }
      const mode = rawMode;
      const entries = buildAgentEntries(plan, mode);
      if (!entries.length) {
        exitWithError("No tasks found to launch.");
      }
      const providerConfig = resolveProviderConfig({
        provider: options.provider,
        providerConfig: options.providerConfig,
        baseUrl: options.baseUrl,
        endpoint: options.endpoint,
      });
      const apiKey = resolveApiKey(options.apiKey, providerConfig);
      const basicAuth = Buffer.from(`${apiKey}:`, "utf8").toString("base64");
      const errors = [];

      for (const entry of entries) {
        const prompt = buildAgentPrompt(plan, entry.task, entry.subtask);
        const agentName = buildAgentName(plan, entry.task, entry.subtask);
      const autoBranch = options.autoBranch;
        const context = {
          api_key: apiKey,
          basic_auth: basicAuth,
          prompt,
          agent_name: agentName,
          plan_title: plan.title || "",
          task_id: entry.task?.id || "",
          task_name: entry.task?.name || "",
          subtask_id: entry.subtask?.id || "",
          subtask_goal: entry.subtask?.goal || "",
          repository: options.repo || undefined,
          ref: options.ref || undefined,
          pr_url: options.prUrl || undefined,
          model: options.model || undefined,
          auto_create_pr: options.autoCreatePr ? true : undefined,
          open_as_cursor_github_app: options.openAsCursorGithubApp
            ? true
            : undefined,
          skip_reviewer_request: options.skipReviewerRequest ? true : undefined,
          branch_name: options.branchName || undefined,
          auto_branch: autoBranch,
          webhook_url: options.webhookUrl || undefined,
          webhook_secret: options.webhookSecret || undefined,
        };

        if (
          providerConfig.name === "cursor" &&
          !context.repository &&
          !context.pr_url
        ) {
          exitWithError(
            "Cursor launch requires --repo or --pr-url for source."
          );
        }
        if (context.webhook_secret && context.webhook_secret.length < 32) {
          exitWithError("webhook secret must be at least 32 characters.");
        }

        try {
          const request = buildLaunchRequest(providerConfig, context);
          if (request.missing && request.missing.has("prompt")) {
            throw new Error("Prompt is required for provider request.");
          }
          if (
            request.missing &&
            (request.missing.has("api_key") || request.missing.has("basic_auth"))
          ) {
            throw new Error("API key is required for provider request.");
          }

          if (options.dryRun) {
            const safeHeaders = redactHeaders(request.headers);
            console.log(
              JSON.stringify(
                {
                  url: request.url,
                  method: request.method,
                  headers: safeHeaders,
                  body: request.body,
                },
                null,
                2
              )
            );
            continue;
          }

          const result = await sendLaunchRequest(request);
          console.log(
            JSON.stringify(
              {
                agent: agentName,
                response: result,
              },
              null,
              2
            )
          );
        } catch (error) {
          if (!options.continueOnError) {
            throw error;
          }
          errors.push({ agent: agentName, message: error.message });
          console.error(`Failed to launch ${agentName}: ${error.message}`);
        }
      }

      if (errors.length) {
        throw new Error(
          [
            "One or more agent launches failed:",
            ...errors.map((entry) => `- ${entry.agent}: ${entry.message}`),
          ].join("\n")
        );
      }
    } catch (error) {
      exitWithError(error.message);
    }
  });

program.parse(process.argv);
