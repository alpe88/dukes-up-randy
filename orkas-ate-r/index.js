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
      exitWithError("Prompt is required.");
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
  .option("--base-url <url>", "Override provider base URL")
  .option("--endpoint <path>", "Override provider launch endpoint")
  .option("--dry-run", "Print requests without sending them")
  .action(async (options) => {
    try {
      const { plan } = loadPlanFile(options.plan);
      const mode = options.mode === "subtask" ? "subtask" : "group";
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

      for (const entry of entries) {
        const prompt = buildAgentPrompt(plan, entry.task, entry.subtask);
        const agentName = buildAgentName(plan, entry.task, entry.subtask);
        const context = {
          api_key: apiKey,
          prompt,
          agent_name: agentName,
          plan_title: plan.title || "",
          task_id: entry.task?.id || "",
          task_name: entry.task?.name || "",
          subtask_id: entry.subtask?.id || "",
          subtask_goal: entry.subtask?.goal || "",
        };

        const request = buildLaunchRequest(providerConfig, context);

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
      }
    } catch (error) {
      exitWithError(error.message);
    }
  });

program.parse(process.argv);
