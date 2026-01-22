# gitter-done

Manage projects and milestones so you can build a lightweight roadmap and
allocate work around clear milestone goals.

## Quick start

Requires Node.js 20+ (Commander 14).

Install globally:

```bash
npm install -g gitter-done
```

Or run without install:

```bash
npx gitter-done init
```

Local development in this repo:

```bash
npm install --prefix gitter-done
node gitter-done/index.js init
```

The roadmap data is stored in `gitter-done.json` in your current directory.
You can override the location with `--file <path>`.

## Usage

```bash
# Initialize a roadmap file
gitter-done init

# Add a project
gitter-done project add "Payments Revamp" \
  --description "Upgrade billing flows" \
  --owner "platform-team"

# Add a milestone
gitter-done milestone add "Payments Revamp" "MVP Launch" \
  --start 2026-02-01 \
  --due 2026-03-15 \
  --status planned \
  --workload "2 engineers"

# List projects or milestones
gitter-done project list
gitter-done milestone list "Payments Revamp"

# Update milestone status
gitter-done milestone update "Payments Revamp" "MVP Launch" \
  --status in-progress
```

## Status values

- Projects: `planned`, `active`, `paused`, `completed`
- Milestones: `planned`, `in-progress`, `blocked`, `completed`

## Roadmap file

The CLI reads and writes a single JSON file that contains your projects and
milestones. Commit it to source control if you want the roadmap to live with
your repository.
