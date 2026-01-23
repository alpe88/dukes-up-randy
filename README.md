# dukes-up-randy

Scaffold frontend, backend, and database folders with a single CLI command.

## Install

```bash
npm install -g dukes-up-randy
# or run without install
npx dukes-up-randy create -n my-project -f react:web -d sqlite:db
```

## Usage

```bash
dukes-up-randy create \
  -n my-project \
  -p /path/to/projects \
  -f react:web,vue:admin \
  -d sqlite:app-db
```

Options:

- `-n, --project-name <project-name>`: name of the project folder
- `-p, --path <path>`: parent path where the project is created
- `-f, --frontends <frontends...>`: frontend templates, `type:name`
- `-d, --databases <databases...>`: database templates, `type:name`

Supported frontends: `vue`, `react`, `preact`, `vuets`, `reactts`, `preactts`,
`nextjs`.

Supported databases: `sqlite` (others pending).
