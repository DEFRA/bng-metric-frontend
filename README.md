# bng-metric-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_bng-metric-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_bng-metric-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_bng-metric-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_bng-metric-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_bng-metric-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_bng-metric-frontend)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Security](#security)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v22` and [npm](https://nodejs.org/) `>= v9`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd bng-metric-frontend
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Exporting the error messages

Every message a customer can see when the service refuses something lives in
`src/server/common/error-text/error-text.yaml`. To review them as a table:

```bash
npm run export:error-text
```

This writes `export/error-messages-<date>-<HHmmss>-<branch>-<commit>` as
`.xlsx`, `.csv` and `.html`: the time is UTC, and a run in GitHub Actions adds
`-run<run ID>`, as in
`error-messages-2026-11-11-143005-main-ab640af-run43044358011.xlsx`.

Each file has a row for each of the backend's error codes, such as
`VALIDATION_UNAVAILABLE`: the `upload.errors` and `edit` entries, a code met in
both as one row. It also has a row for each shared page those codes show, such
as `upload.catchAll`, with its words and the codes that use it. The file's
other entries are left out by default, to keep the export short enough to
review. `-- --include GROUPS` adds them back, by group, separated by commas:
`upload-text` (the drop-out page's other words, such as `upload.page.title`),
`common`, `forms` and `pages`, or `all` for every one.

A row gives:

- each part of the message, in its own column, as the user sees it: a link by
  its text, with where it goes in Links. A wording given as options says when
  each after the first is used, as "If {ref} is not known:"; a page given in
  versions gives each a line, after when it is shown; and the catch-all's
  words say which template file they are for. A single-problem page's wording
  for several habitats is in the "(several)" columns;
- its status: Final, Awaiting UCD or Needs content, from the entry's `wording`
  field. A row that shows a shared page's words is no further on than that
  page, so an error with no `wording` field of its own is Awaiting UCD when
  its shared page is interim;
- Shared page and Shared list heading: the shared page it shows when it is the
  file's only problem, and the shared title heading its entry when there are
  others. Their words are in the row's Page heading, Body and List heading;
- Shown instead: what the user sees in place of words an entry has yet to
  have: the problems list, for an error with no single-problem page or none
  worded for several habitats, or the error page a refused change made on
  screen shows, with its words;
- what its `{values}` are filled in with, and a link to its line in the file.

Each CSV row ends with the date, branch and commit it was read from, and the
groups of rows exported. The file is
checked as the server checks it at start-up, so the export refuses a file the
server would. `-- --out DIR` writes elsewhere, and `-- --help` lists the
options.

The Error Messages Export workflow runs the export on every pull request to
`main`, on every push to `main`, and on demand from the Actions tab for the
branch picked there. Each run keeps the three files as one
`error-messages-export` artifact for 90 days, and its summary counts the error
IDs with each status and links to the artifact. A run on demand can add groups
of rows, as `--include` does, in its `include` field. A pull request's run exports
the wording on the pull request's branch, and links each row to its line at
the branch's head commit. It is not a required check, so it never holds up a
merge.

A pull request's summary also says what it changes in the wording, against the
commit its branch left `main` at, and so does a push to `main`'s, against
`main` as it was before the push, so each merge's run says what it changed. A
run on demand has nothing to compare with. The comparison gives the error IDs
added and removed, with their
words, a before and after for each part of a message it changes, and each
status it moves. Errors changed alike, such as every error showing a reworded
shared fallback, share one table. Only the groups of rows exported are
compared, and the heading names them, as in "Wording changes in codes": a
change to a `forms.*` entry, say, shows only when `forms` is exported. The
Export the error messages step's log
gives the same as plain text, so the changes show without opening the
summary. To see the same locally, add `-- --base REF`, naming the
commit your branch left `main` at:
`npm run export:error-text -- --base "$(git merge-base origin/main HEAD)"`.
Naming `origin/main` itself would show a change merged to `main` since as your
branch undoing it.

When the comparison finds a change that leaves wording unfinished, an error
added that is not Final, or one whose status moves back, as from Final to
Awaiting UCD, the run warns of it with a GitHub annotation on that entry's line
of `error-text.yaml`. It shows beside the line in a pull request's Files
changed, and on the run. GitHub keeps only 10 warnings from a step, so past 9
the tenth says how many more there are; the run's summary and log list every
change. It warns of nothing that was unfinished before the change, and never
fails the run.

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag bng-metric-frontend`

Build:

```bash
docker build --target development --no-cache --tag bng-metric-frontend:development .
```

Run:

```bash
docker run -p 3000:3000 bng-metric-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag bng-metric-frontend .
```

Run:

```bash
docker run -p 3000:3000 bng-metric-frontend
```

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Security

CSRF protection is enabled globally via [`@hapi/crumb`](https://github.com/hapijs/crumb).
See [docs/csrf.md](docs/csrf.md) before adding forms or state-changing routes —
it covers the `appForm` macro, the `primeCrumb` test helper, when to disable
crumb, and a PR review checklist.

Authentication (OIDC via Defra Identity) is documented in
[docs/authentication.md](docs/authentication.md).

### Secret scanning

This repo scans for secrets at three independent layers — a real credential has to slip past all three to reach `main`:

| Layer        | When         | What runs                                                 |
| ------------ | ------------ | --------------------------------------------------------- |
| pre-commit   | `git commit` | `gitleaks protect --staged` on the staged diff (< 200ms)  |
| pre-push     | `git push`   | `gitleaks detect` on `@{u}..HEAD` (catches `--no-verify`) |
| CI (PR-gate) | every PR     | `gitleaks-action` + `trufflehog --only-verified`          |

`npm install && npm run postinstall` — `.npmrc` sets `ignore-scripts=true` (see below), so the `postinstall` script that configures `husky` no longer fires automatically and has to be run once by hand. It also runs `scripts/install-gitleaks.mjs`, which downloads a pinned gitleaks binary into `node_modules/.gitleaks/bin/` (verifies SHA-256; reuses any system `gitleaks` already on `PATH`). No `brew install` needed.

#### Why `ignore-scripts`

`ignore-scripts=true` in `.npmrc` blocks npm from auto-running preinstall/install/postinstall/prepare scripts for this package and every dependency — the mechanism behind npm supply-chain worms (e.g. Shai-Hulud) that execute arbitrary code the moment a compromised package is installed. It applies uniformly to local installs, CI, and Docker builds, since all three read this committed `.npmrc`.

Scripts run explicitly via `npm run <name>` (like `postinstall` above) are unaffected — only npm's automatic triggering during install is disabled. If a dependency genuinely needs its own install script to function (e.g. to build a native addon), run it for just that package with `npm rebuild <package>`, or override for a single command with `npm install --ignore-scripts=false`. Note the override and its justification in the PR, and record any standing exception in Confluence.

If the download fails (firewall/offline), fall back to a system install:

```bash
brew install gitleaks            # macOS
sudo apt install gitleaks        # Debian/Ubuntu
choco install gitleaks           # Windows
```

**Allowlisting a false positive:** edit `.gitleaks.toml` and open a PR — reviewers must approve the widening.

**Emergency bypass:** `git commit --no-verify` / `git push --no-verify`. CI still scans the PR and blocks the merge.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
