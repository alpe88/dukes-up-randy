# orkas-ate-r (oar)

Generate structured plan JSON files and launch cloud agents per task group or
subtask.

## Install

```bash
npm install -g orkas-ate-r
```

Run from this repo:

```bash
npm install --prefix orkas-ate-r
node orkas-ate-r/index.js --help
```

## Create a plan

```bash
oar plan "Node 22 lambda migration plan" -o oar-plan.json
```

This command writes a structured JSON file based on the prompt. The output uses
the same structure as the template and is meant to be refined after generation.

## Write the template

```bash
oar template -o oar-plan.template.json
```

You can also print the template to stdout:

```bash
oar template --stdout
```

## Launch cloud agents

```bash
export CURSOR_API_KEY="your-token"
oar launch \
  --plan oar-plan.json \
  --repo https://github.com/your-org/your-repo \
  --ref main
```

By default, `launch` starts one agent per top-level task group. Use subtask mode
to launch per subtask:

```bash
oar launch --plan oar-plan.json --mode subtask --repo https://github.com/your-org/your-repo
```

To preview the requests without sending them:

```bash
oar launch --plan oar-plan.json --dry-run --repo https://github.com/your-org/your-repo
```

## Provider config

Launch requests are driven by a provider config JSON file. Start from the
example at `templates/cursor-provider.json` or rely on the built-in Cursor
defaults (`https://api.cursor.com/v0/agents`).

https://docs.cursor.com/cloud-agent/api/endpoints#launch-an-agent

The config supports placeholder values such as `${prompt}`, `${task_id}`, and
`${agent_name}`. The API key is read from `CURSOR_API_KEY` by default; you can
also pass `--api-key`, but note that command-line arguments can be visible in
shell history and process listings.

### Cursor-specific options

- `--repo <url>`: sets `source.repository`
- `--ref <ref>`: sets `source.ref`
- `--pr-url <url>`: sets `source.prUrl` (overrides repo/ref)
- `--model <name>`: sets `model`
- `--auto-create-pr`: sets `target.autoCreatePr`
- `--open-as-cursor-github-app`: sets `target.openAsCursorGithubApp`
- `--skip-reviewer-request`: sets `target.skipReviewerRequest`
- `--branch-name <name>`: sets `target.branchName`
- `--auto-branch <true|false>`: sets `target.autoBranch`
- `--webhook-url <url>` / `--webhook-secret <secret>`: sets webhook fields
