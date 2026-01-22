# gitter-done

Manage projects and milestones so you can build a lightweight roadmap and
allocate work around clear milestone goals.

## Quick start

Requires Node.js 20+ (Commander 14).

1. Install dependencies where you use the tool:
   - `npm install --prefix gitter-done`
2. Run the CLI from your repo:
   - `node gitter-done/index.js init`
   - or, after `npm link`, use `gitter-done init`

The roadmap data is stored in `gitter-done.json` in your current directory.
You can override the location with `--file <path>`.

## Usage

```bash
# Initialize a roadmap file
node gitter-done/index.js init

# Add a project
node gitter-done/index.js project add "Payments Revamp" \
  --description "Upgrade billing flows" \
  --owner "platform-team"

# Add a milestone
node gitter-done/index.js milestone add "Payments Revamp" "MVP Launch" \
  --start 2026-02-01 \
  --due 2026-03-15 \
  --status planned \
  --workload "2 engineers"

# List projects or milestones
node gitter-done/index.js project list
node gitter-done/index.js milestone list "Payments Revamp"

# Update milestone status
node gitter-done/index.js milestone update "Payments Revamp" "MVP Launch" \
  --status in-progress
```

## Status values

- Projects: `planned`, `active`, `paused`, `completed`
- Milestones: `planned`, `in-progress`, `blocked`, `completed`

## Roadmap file

The CLI reads and writes a single JSON file that contains your projects and
milestones. Commit it to source control if you want the roadmap to live with
your repository.
