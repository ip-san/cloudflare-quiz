/**
 * Centralized topic-specific configuration for quiz build scripts.
 *
 * All doc pages, backtick-lint term lists, and terminology corrections
 * used by quiz-lint.mjs / quiz-fact-check.mjs / quiz-cross-check.mjs /
 * fetch-docs.mjs are consolidated here as single-source-of-truth exports.
 *
 * Doc pages mirror VALID_DOC_PAGES in
 * src/infrastructure/validation/quizContentQuality.test.ts — keep both in
 * sync when a quiz references a new developers.cloudflare.com page.
 */

// ============================================================
// Documentation Pages
// ============================================================

/**
 * All official doc pages referenced by quizzes.json, used by fetch-docs.mjs
 * for caching and by quiz-lint.mjs (url check) for anchor validation.
 * `name` is the path under https://developers.cloudflare.com/ (no leading/
 * trailing slash) and doubles as the doc-source path in the
 * cloudflare/cloudflare-docs GitHub repository.
 */
export const DOC_PAGES = [
  { name: 'ai-gateway' },
  { name: 'ai-gateway/features/caching' },
  { name: 'ai-gateway/configuration/fallbacks' },
  { name: 'ai-gateway/observability/logging' },
  { name: 'cache/advanced-configuration/cache-reserve' },
  { name: 'cache/how-to/tiered-cache' },
  { name: 'cloudflare-for-platforms/workers-for-platforms' },
  { name: 'cloudflare-one/access-controls/policies' },
  { name: 'd1' },
  { name: 'd1/best-practices/local-development' },
  { name: 'd1/best-practices/read-replication' },
  { name: 'd1/best-practices/use-indexes' },
  { name: 'd1/get-started' },
  { name: 'd1/platform/limits' },
  { name: 'd1/reference/community-projects' },
  { name: 'd1/reference/migrations' },
  { name: 'd1/reference/time-travel' },
  { name: 'd1/sql-api/foreign-keys' },
  { name: 'd1/worker-api/d1-database' },
  { name: 'd1/worker-api/prepared-statements' },
  { name: 'd1/wrangler-commands' },
  { name: 'durable-objects' },
  { name: 'durable-objects/api/alarms' },
  { name: 'durable-objects/api/namespace' },
  { name: 'durable-objects/api/sqlite-storage-api' },
  { name: 'durable-objects/api/stub' },
  { name: 'durable-objects/best-practices/rules-of-durable-objects' },
  { name: 'durable-objects/best-practices/websockets' },
  { name: 'durable-objects/concepts/what-are-durable-objects' },
  { name: 'durable-objects/reference/data-location' },
  { name: 'kv/api/list-keys' },
  { name: 'kv/api/read-key-value-pairs' },
  { name: 'kv/api/write-key-value-pairs' },
  { name: 'kv/concepts/how-kv-works' },
  { name: 'kv/get-started' },
  { name: 'kv/platform/limits' },
  { name: 'pages' },
  { name: 'pages/configuration/build-caching' },
  { name: 'pages/configuration/build-configuration' },
  { name: 'pages/configuration/custom-domains' },
  { name: 'pages/configuration/git-integration' },
  { name: 'pages/configuration/headers' },
  { name: 'pages/configuration/monorepos' },
  { name: 'pages/configuration/preview-deployments' },
  { name: 'pages/configuration/redirects' },
  { name: 'pages/configuration/rollbacks' },
  { name: 'pages/functions/bindings' },
  { name: 'pages/functions/middleware' },
  { name: 'pages/functions/routing' },
  { name: 'pages/get-started/direct-upload' },
  { name: 'queues' },
  { name: 'queues/configuration/batching-retries' },
  { name: 'queues/configuration/consumer-concurrency' },
  { name: 'queues/configuration/dead-letter-queues' },
  { name: 'queues/configuration/pull-consumers' },
  { name: 'queues/reference/how-queues-works' },
  { name: 'r2' },
  { name: 'r2/api/s3/presigned-urls' },
  { name: 'r2/api/tokens' },
  { name: 'r2/api/workers/workers-api-reference' },
  { name: 'r2/buckets' },
  { name: 'r2/buckets/cors' },
  { name: 'r2/buckets/event-notifications' },
  { name: 'r2/buckets/object-lifecycles' },
  { name: 'r2/buckets/public-buckets' },
  { name: 'r2/buckets/storage-classes' },
  { name: 'r2/data-migration/super-slurper' },
  { name: 'r2/objects/upload-objects' },
  { name: 'r2/pricing' },
  { name: 'r2/reference/wrangler-commands' },
  { name: 'vectorize' },
  { name: 'vectorize/best-practices/create-indexes' },
  { name: 'vectorize/best-practices/insert-vectors' },
  { name: 'vectorize/platform/limits' },
  { name: 'vectorize/reference/client-api' },
  { name: 'vectorize/reference/metadata-filtering' },
  { name: 'vectorize/reference/what-is-a-vector-database' },
  { name: 'waf/rate-limiting-rules' },
  { name: 'workers-ai' },
  { name: 'workers-ai/configuration/bindings' },
  { name: 'workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai' },
  { name: 'workers-ai/models' },
  { name: 'workers' },
  { name: 'workers/configuration/compatibility-dates' },
  { name: 'workers/configuration/cron-triggers' },
  { name: 'workers/configuration/placement' },
  { name: 'workers/configuration/secrets' },
  { name: 'workers/framework-guides/web-apps/nextjs' },
  { name: 'workers/get-started/guide' },
  { name: 'workers/observability/logs' },
  { name: 'workers/platform/limits' },
  { name: 'workers/platform/pricing' },
  { name: 'workers/platform/storage-options' },
  { name: 'workers/reference/how-workers-works' },
  { name: 'workers/reference/migrate-to-module-workers' },
  { name: 'workers/runtime-apis/bindings' },
  { name: 'workers/runtime-apis/bindings/service-bindings' },
  { name: 'workers/runtime-apis/cache' },
  { name: 'workers/runtime-apis/context' },
  { name: 'workers/runtime-apis/handlers/fetch' },
  { name: 'workers/runtime-apis/html-rewriter' },
  { name: 'workers/runtime-apis/nodejs' },
  { name: 'workers/runtime-apis/request' },
  { name: 'workers/runtime-apis/streams' },
  { name: 'workers/static-assets' },
  { name: 'workers/static-assets/binding' },
  { name: 'workers/versions-and-deployments/gradual-deployments' },
  { name: 'workers/versions-and-deployments/rollbacks' },
  { name: 'workers/wrangler/commands' },
  { name: 'workers/wrangler/commands/general' },
  { name: 'workers/wrangler/commands/workers' },
  { name: 'workers/wrangler/configuration' },
  { name: 'workers/wrangler/environments' },
].map((p) => ({ ...p, url: `https://developers.cloudflare.com/${p.name}/` }))

/**
 * Some doc pages are thin navigation stubs (`<DirectoryListing />`) or
 * `<Render file="..." />` includes — the real command reference text lives
 * in src/content/partials/, a separate root fetch-docs.mjs doesn't reach by
 * default. Found via quiz-fact-check.mjs false-positives on real commands
 * (`wrangler tail`, `wrangler r2 bucket create`) during the 2026-07-21
 * quality-loop run: workers/wrangler/commands/index.mdx and
 * r2/reference/wrangler-commands.mdx only reference the actual content,
 * they don't contain it. Maps DOC_PAGES `name` → explicit path under
 * src/content/ (not src/content/docs/) for fetch-docs.mjs to fetch instead
 * of guessing the usual docs/ candidates.
 */
export const DOC_PAGE_OVERRIDES = {
  'r2/reference/wrangler-commands': 'partials/workers/wrangler-commands/r2.mdx',
  // d1/wrangler-commands renders <WranglerNamespace namespace="d1" />, which
  // has no static source text at all (subcommands are generated from
  // Wrangler's own CLI schema at build time) — no override target exists.
  // quiz-fact-check.mjs will report d1 subcommand terms as "not found"
  // regardless; verify those manually against `wrangler d1 --help`.
}

/**
 * Per-category doc groupings and extra reference links.
 * Not yet consumed by any script (reserved for future doc-coverage
 * tooling) — kept empty rather than guessed to avoid silently-wrong data.
 */
export const CATEGORY_DOC_MAP = {}
export const SUPPLEMENTARY_DOCS = []

export const DOC_URL_PREFIX = 'https://developers.cloudflare.com/'
/** No secondary doc domain is currently referenced by quizzes.json. */
export const ADDITIONAL_DOC_PREFIXES = []

// ============================================================
// Doc cache filename helpers (shared by fetch-docs.mjs / quiz-lint.mjs /
// quiz-fact-check.mjs so the on-disk cache and the URL-derived page id
// always agree without needing an alias table).
// ============================================================

export function docPageToFilename(name) {
  return `${name.replace(/\//g, '__')}.md`
}

export function filenameToDocPage(filename) {
  return filename.replace(/\.md$/, '').replace(/__/g, '/')
}

/**
 * Matches Cloudflare's `<WranglerCommand command="X" ... />` MDX component.
 * Shared by fetch-docs.mjs (to inline a plain-text "wrangler X" line next to
 * the tag) and quiz-lint.mjs (to treat `X` as an implicit heading/anchor) —
 * a single source avoids the two drifting if the component ever changes.
 * Always construct a fresh RegExp from this source per use (module-level
 * regexes with the `g` flag carry mutable `lastIndex` state across callers).
 */
export const WRANGLER_COMMAND_TAG_SOURCE = '<WranglerCommand\\s+command="([^"]+)"'

// ============================================================
// Backtick Lint Terms
// ============================================================

/**
 * Terms that should always be backtick-formatted when they appear in quiz
 * text. Empty arrays are valid — the corresponding lint rule simply becomes
 * a no-op (e.g. Cloudflare docs have no "slash command" or IDE-tool-name
 * concept, unlike the Claude Code docs this config was originally modeled
 * on).
 */
export const BACKTICK_TERMS = {
  // Config / project file names.
  filePaths: ['wrangler.toml', 'wrangler.jsonc', '.dev.vars', 'schema.sql', 'package.json'],
  // No slash-command concept in Cloudflare docs — kept as a never-matching
  // pattern so quiz-lint.mjs's dispatch code stays uniform across topics.
  slashCommands: /(?!x)x/,
  // Workers export handler method names (fetch/scheduled/queue/email/alarm).
  hookEvents: ['fetch', 'scheduled', 'queue', 'email', 'alarm', 'tail'],
  // No IDE-tool-name concept for this topic.
  toolNames: [],
  // wrangler.toml / wrangler.jsonc configuration keys.
  configKeys: [
    'compatibility_date',
    'compatibility_flags',
    'account_id',
    'workers_dev',
    'kv_namespaces',
    'd1_databases',
    'r2_buckets',
    'durable_objects',
    'queues.producers',
    'queues.consumers',
    'vars',
    'routes',
    'triggers.crons',
    'migrations',
    'assets',
    'placement.mode',
    'observability.enabled',
    'limits.cpu_ms',
  ],
  // Full wrangler CLI invocations.
  cliCommands: [
    'wrangler dev',
    'wrangler deploy',
    'wrangler tail',
    'wrangler login',
    'wrangler whoami',
    'wrangler secret put',
    'wrangler d1 execute',
    'wrangler d1 migrations apply',
    'wrangler d1 migrations create',
    'wrangler kv key put',
    'wrangler kv key get',
    'wrangler kv namespace create',
    'wrangler r2 object put',
    'wrangler r2 bucket create',
    'wrangler queues consumer add',
    'wrangler pages deploy',
    'wrangler versions deploy',
    'wrangler triggers deploy',
  ],
}

// ============================================================
// Terminology Dictionary
// ============================================================

/**
 * Seed list of unambiguous terminology/casing corrections. Left empty by
 * design — an earlier draft included a "`wrangler.json` isn't a real config
 * file, only `wrangler.jsonc` is" entry, which turned out to be wrong: as of
 * Wrangler v3.91, `wrangler.json` *and* `wrangler.jsonc` are both supported
 * (see workers/wrangler/configuration in the official docs). That entry
 * would have flagged correct quiz content as an error. Add entries here
 * only after confirming them against the fetched doc cache or the official
 * site, not from memory — see quiz-fact-check.mjs for the same discipline
 * applied to KNOWN_NONEXISTENT_TERMS below.
 */
export const TERMINOLOGY_DICT = []

// ============================================================
// Negation Detection
// ============================================================

/**
 * Matches phrases indicating the surrounding text asserts that something
 * does NOT exist / is NOT supported. Used to suppress false-positive
 * terminology/fact-check flags on quizzes that intentionally teach
 * "X is not a real feature".
 */
export const NEGATION_MARKERS =
  /存在しません|存在しない|サポートされていません|サポートしていません|廃止|非推奨|できません|ではありません|does not exist|is not supported|does not support|was removed|deprecated/i

// ============================================================
// Known-Nonexistent Terms
// ============================================================

/**
 * Features/terms confirmed NOT to exist (or not to work as commonly
 * assumed), for use by quiz-fact-check.mjs's "positive mention of a
 * nonexistent feature" check. Left empty by design: entries here must be
 * independently verified against official docs before being added, since a
 * wrong entry would cause the quality gate to flag *correct* content as an
 * error. Add entries as they are confirmed during manual review.
 */
export const KNOWN_NONEXISTENT_TERMS = []
