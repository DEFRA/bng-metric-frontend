# Google Tag Manager (BMD-1010)

The shared layout loads non-prod container `GTM-K5LRK3HR`. Set `ENVIRONMENT`
to `dev`, `test`, `ext-test` or `perf-test` in CDP; local development uses
`local`. `NODE_ENV=production` is also used by non-prod deployments and does
not determine whether GTM is enabled. Production (`prod`), missing and unknown
deployment environments omit both snippets and the Google CSP permissions.
Set `GTM_ENABLED=false` to disable GTM in any environment.

The supplied head script is unchanged. CSP permits its exact SHA-256 hash,
GTM and the GA collection endpoints, without allowing arbitrary inline scripts
or eval. The noscript iframe uses the first available GOV.UK `bodyStart` hook,
after GOV.UK's built-in feature-detection script and before the skip link.
Its URL's trailing space was removed and an accessible title added. Its inline
hiding style is allowed by a matching CSP hash.

Consent is temporarily assumed for this ticket, as agreed, until BMD-568
implements the cookie banner. Before GTM loads, a separate inline script queues
`consent default` with `analytics_storage: granted`; `ad_storage`, `ad_user_data`
and `ad_personalization` stay `denied`. Both scripts have exact CSP hashes.
No consent cookie is written. Container loading and GA tag firing are separate: the tags and
their triggers are maintained in GTM, not in this application. BMD-568 must
gate GA tags on explicit consent, including preventing cookieless GA requests
before consent, and persist rejection/withdrawal across navigation.

The snippet adds only `gtm.start` and `gtm.js` to the data layer. It does not
send user details, project names or form values. This alone cannot guarantee
that the container's tags do not collect PII: before enabling its GA tags,
configure them to exclude user/project data, query strings, identifiers and
unsafe referrers from page views, and disable collection of form values or
DOM text. Check the actual GA payloads; default page-location tracking can
include query strings. Use synthetic data for verification.

## Non-prod verification

1. Confirm `ENVIRONMENT` is set and GTM is enabled. Open the landing page with
   the network tab active: `gtm.js?id=GTM-K5LRK3HR` should load.
2. Navigate to another service page, such as Projects, with the network log
   preserved. Confirm the container loads once on each full navigation.
3. Using the container's GTM Preview and/or GA4 DebugView, verify GA tags fire
   with assumed consent and inspect outgoing collection requests for PII.
   In Preview, confirm analytics consent is granted before the GTM event and
   the GA tag's additional `analytics_storage` check is satisfied.
   The app does not publish tags or configure a GA measurement ID.
4. CSP permits normal GTM/GA loading. Preview-specific assets may need a
   separately scoped non-prod policy; use GA4 DebugView or the network tab
   if the Preview UI reports blocked assets. Do not enable unsafe-eval.
5. Set `GTM_ENABLED=false`, then restart: no container snippets or Google CSP
   permissions should remain. Repeat with `ENVIRONMENT=prod` and GTM enabled.
6. After BMD-568, test accepted, rejected, un-actioned and withdrawn consent on
   this page and the next page, verifying that no GA requests are sent without
   explicit consent while the GTM container still loads.

Browser verification requires access to the deployed service and GTM/GA
accounts. Automated tests check environment isolation, rendering across four
page templates, consent before GTM startup, preservation of an existing data
layer, script execution and CSP hash consistency; they do not verify
the live container's tag configuration or claim that GA requests are PII-free.

The Confluence setup guide also requires importing the supplied Google tag
template into the non-prod container, replacing `G-XXXXXXXXXX` with the real
GA4 data-stream measurement ID, and publishing it after QA. Its additional
consent check requires `analytics_storage`, which the temporary initialisation
above grants. A GTM consent-initialisation tag can override the site's defaults,
so check the final state in Preview. Publishing and verifying that configuration
requires GTM/GA account access; the application change does not configure tags.

References: [Google's CSP guidance](https://developers.google.com/tag-platform/security/guides/csp),
[consent implementation](https://developers.google.com/tag-platform/security/guides/consent),
and [avoiding PII in Analytics](https://support.google.com/analytics/answer/6366371).
