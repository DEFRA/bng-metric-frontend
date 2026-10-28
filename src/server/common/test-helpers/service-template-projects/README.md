# Service-template project fixtures

Projects uploaded in the BNG Service template, as the backend's
`GET /projects/{id}` returns them (BMD-1086). They are the frontend's side of
the project JSON contract for that template: tests load them with
`serviceTemplateProject(name)` from `index.js`, which returns a fresh copy.

They aren't written by hand. Each is a real upload through the backend, with
`SERVICE_TEMPLATE_ENABLED=true`, of a file from the harness's curated corpus,
`bng-metric-harness/example-files/service-template/`.

| Fixture                               | Corpus file                                                    | Endpoint                                | What it shows                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `two-stages.json`                     | `valid/default-site.gpkg`                                      | `POST /post-intervention/validate/{id}` | Both stages. Every post-intervention feature with a parent names it by `parentFeatureId`, Created ones included; `postIntervention.lostHabitats` has every outcome |
| `baseline-only.json`                  | `valid/default-site-baseline.gpkg`                             | `POST /baseline/validate/{id}`          | A project with only a baseline: no `postIntervention` key                                                                                                          |
| `watercourse-advance-incomplete.json` | `incomplete/degrade-watercourse-advance-not-encroachment.gpkg` | `POST /post-intervention/validate/{id}` | A degraded watercourse created 10 years in advance, which the backend clears and saves Incomplete                                                                  |

Captured at bng-metric-backend `76ce71e` (bng-library `93f8d08`) from harness
`a4c9bad`. Both documents carry `template: { name: 'bng-service', version: '1.0' }`,
and every area habitat its `irreplaceable` status. Individual trees (BMD-1172)
and vertical area habitats (BMD-1084) aren't read yet, so `trees` is empty.

## Regenerating them

When the backend changes the project JSON for this template, capture them
again rather than editing them. With the backend's Docker services up
(`docker compose up -d` in bng-metric-backend), add this as a temporary file in
the backend's `integration-tests/`, run it, then delete it:

```js
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import {
  callPostInterventionValidate,
  callValidate,
  createProject,
  getPersistenceTestContext,
  registerPersistenceTestHooks,
  uploadFixture
} from './helpers/persistence-test-setup.js'

registerPersistenceTestHooks()

const CORPUS = process.env.CORPUS // the harness's example-files/service-template
const OUT = process.env.CAPTURE_OUT // this directory
const CASES = [
  ['two-stages', 'valid/default-site.gpkg', callPostInterventionValidate],
  ['baseline-only', 'valid/default-site-baseline.gpkg', callValidate],
  [
    'watercourse-advance-incomplete',
    'incomplete/degrade-watercourse-advance-not-encroachment.gpkg',
    callPostInterventionValidate
  ]
]

it.each(CASES)('captures %s', async (name, file, validate) => {
  const project = await createProject(`BMD-1086 ${name}`)
  const uploadId = await uploadFixture(file, path.join(CORPUS, file))
  const res = await validate(uploadId, { projectId: project.id })
  expect(res.result).toEqual({ valid: true, errors: [] })
  const { server, headers } = getPersistenceTestContext()
  const got = await server.inject({
    method: 'GET',
    url: `/projects/${project.id}`,
    headers
  })
  expect(got.statusCode).toBe(200)
  writeFileSync(
    path.join(OUT, `${name}.json`),
    JSON.stringify(got.result, null, 2) + '\n'
  )
})
```

```sh
SERVICE_TEMPLATE_ENABLED=true CORPUS=… CAPTURE_OUT=… \
  npx cross-env TZ=UTC vitest run --config vitest.integration.config.js \
  integration-tests/<the file>.test.js
```

Then update the commits above, and run `contract.test.js`: it pins what the
frontend relies on, so it fails if the backend's shape moved under it.
