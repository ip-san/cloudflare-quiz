/**
 * Centralized topic-specific configuration for quiz build scripts.
 *
 * All doc pages, category mappings, backtick-lint term lists, and
 * terminology corrections that were previously scattered across
 * fetch-docs.mjs, quiz-constants.mjs, and quiz-lint.mjs are
 * consolidated here as single-source-of-truth exports.
 */

// ============================================================
// Documentation Pages
// ============================================================

/** All official doc pages (used by fetch-docs.mjs for caching). */
export const DOC_PAGES = [
  // Core
  { name: 'overview', url: 'https://code.claude.com/docs/en/overview' },
  { name: 'quickstart', url: 'https://code.claude.com/docs/en/quickstart' },
  { name: 'settings', url: 'https://code.claude.com/docs/en/settings' },
  { name: 'memory', url: 'https://code.claude.com/docs/en/memory' },
  // Interactive & Tools
  { name: 'interactive-mode', url: 'https://code.claude.com/docs/en/interactive-mode' },
  { name: 'how-claude-code-works', url: 'https://code.claude.com/docs/en/how-claude-code-works' },
  // Extensions & Integration
  { name: 'mcp', url: 'https://code.claude.com/docs/en/mcp' },
  { name: 'hooks', url: 'https://code.claude.com/docs/en/hooks' },
  { name: 'hooks-guide', url: 'https://code.claude.com/docs/en/hooks-guide' },
  { name: 'discover-plugins', url: 'https://code.claude.com/docs/en/discover-plugins' },
  { name: 'plugins', url: 'https://code.claude.com/docs/en/plugins' },
  { name: 'plugins-reference', url: 'https://code.claude.com/docs/en/plugins-reference' },
  { name: 'plugin-marketplaces', url: 'https://code.claude.com/docs/en/plugin-marketplaces' },
  { name: 'sub-agents', url: 'https://code.claude.com/docs/en/sub-agents' },
  { name: 'agent-teams', url: 'https://code.claude.com/docs/en/agent-teams' },
  { name: 'skills', url: 'https://code.claude.com/docs/en/skills' },
  // Advanced
  { name: 'common-workflows', url: 'https://code.claude.com/docs/en/common-workflows' },
  { name: 'checkpointing', url: 'https://code.claude.com/docs/en/checkpointing' },
  { name: 'best-practices', url: 'https://code.claude.com/docs/en/best-practices' },
  { name: 'model-config', url: 'https://code.claude.com/docs/en/model-config' },
  { name: 'sandboxing', url: 'https://code.claude.com/docs/en/sandboxing' },
  { name: 'headless', url: 'https://code.claude.com/docs/en/headless' },
  // Customization & UI
  { name: 'keybindings', url: 'https://code.claude.com/docs/en/keybindings' },
  { name: 'output-styles', url: 'https://code.claude.com/docs/en/output-styles' },
  { name: 'statusline', url: 'https://code.claude.com/docs/en/statusline' },
  { name: 'terminal-config', url: 'https://code.claude.com/docs/en/terminal-config' },
  { name: 'fast-mode', url: 'https://code.claude.com/docs/en/fast-mode' },
  // Platforms & IDE
  { name: 'vs-code', url: 'https://code.claude.com/docs/en/vs-code' },
  { name: 'jetbrains', url: 'https://code.claude.com/docs/en/jetbrains' },
  { name: 'desktop', url: 'https://code.claude.com/docs/en/desktop' },
  { name: 'chrome', url: 'https://code.claude.com/docs/en/chrome' },
  { name: 'slack', url: 'https://code.claude.com/docs/en/slack' },
  // CI/CD & Automation
  { name: 'github-actions', url: 'https://code.claude.com/docs/en/github-actions' },
  { name: 'gitlab-ci-cd', url: 'https://code.claude.com/docs/en/gitlab-ci-cd' },
  { name: 'scheduled-tasks', url: 'https://code.claude.com/docs/en/scheduled-tasks' },
  { name: 'remote-control', url: 'https://code.claude.com/docs/en/remote-control' },
  // Enterprise & Configuration
  { name: 'server-managed-settings', url: 'https://code.claude.com/docs/en/server-managed-settings' },
  { name: 'devcontainer', url: 'https://code.claude.com/docs/en/devcontainer' },
  // Supplementary (not for referenceUrl but useful for fact-checking)
  { name: 'permissions', url: 'https://code.claude.com/docs/en/permissions' },
  { name: 'cli-reference', url: 'https://code.claude.com/docs/en/cli-reference' },
  { name: 'setup', url: 'https://code.claude.com/docs/en/setup' },
  { name: 'features-overview', url: 'https://code.claude.com/docs/en/features-overview' },
  { name: 'desktop-quickstart', url: 'https://code.claude.com/docs/en/desktop-quickstart' },
  { name: 'authentication', url: 'https://code.claude.com/docs/en/authentication' },
  // Cloud & Provider
  { name: 'claude-code-on-the-web', url: 'https://code.claude.com/docs/en/claude-code-on-the-web' },
  { name: 'amazon-bedrock', url: 'https://code.claude.com/docs/en/amazon-bedrock' },
  { name: 'google-vertex-ai', url: 'https://code.claude.com/docs/en/google-vertex-ai' },
  { name: 'microsoft-foundry', url: 'https://code.claude.com/docs/en/microsoft-foundry' },
  { name: 'llm-gateway', url: 'https://code.claude.com/docs/en/llm-gateway' },
  // Enterprise & Security
  { name: 'network-config', url: 'https://code.claude.com/docs/en/network-config' },
  { name: 'third-party-integrations', url: 'https://code.claude.com/docs/en/third-party-integrations' },
  { name: 'analytics', url: 'https://code.claude.com/docs/en/analytics' },
  { name: 'monitoring-usage', url: 'https://code.claude.com/docs/en/monitoring-usage' },
  { name: 'security', url: 'https://code.claude.com/docs/en/security' },
  // Features
  { name: 'code-review', url: 'https://code.claude.com/docs/en/code-review' },
  { name: 'troubleshooting', url: 'https://code.claude.com/docs/en/troubleshooting' },
  // New pages discovered from llms.txt
  { name: 'changelog', url: 'https://code.claude.com/docs/en/changelog' },
  { name: 'channels', url: 'https://code.claude.com/docs/en/channels' },
  { name: 'channels-reference', url: 'https://code.claude.com/docs/en/channels-reference' },
  { name: 'claude-directory', url: 'https://code.claude.com/docs/en/claude-directory' },
  { name: 'commands', url: 'https://code.claude.com/docs/en/commands' },
  { name: 'computer-use', url: 'https://code.claude.com/docs/en/computer-use' },
  { name: 'context-window', url: 'https://code.claude.com/docs/en/context-window' },
  { name: 'costs', url: 'https://code.claude.com/docs/en/costs' },
  { name: 'data-usage', url: 'https://code.claude.com/docs/en/data-usage' },
  { name: 'env-vars', url: 'https://code.claude.com/docs/en/env-vars' },
  { name: 'fullscreen', url: 'https://code.claude.com/docs/en/fullscreen' },
  { name: 'github-enterprise-server', url: 'https://code.claude.com/docs/en/github-enterprise-server' },
  { name: 'legal-and-compliance', url: 'https://code.claude.com/docs/en/legal-and-compliance' },
  { name: 'permission-modes', url: 'https://code.claude.com/docs/en/permission-modes' },
  { name: 'platforms', url: 'https://code.claude.com/docs/en/platforms' },
  { name: 'tools-reference', url: 'https://code.claude.com/docs/en/tools-reference' },
  { name: 'voice-dictation', url: 'https://code.claude.com/docs/en/voice-dictation' },
  { name: 'web-scheduled-tasks', url: 'https://code.claude.com/docs/en/web-scheduled-tasks' },
  { name: 'zero-data-retention', url: 'https://code.claude.com/docs/en/zero-data-retention' },
  // Auto-discovered from llms.txt (2026-04-04)
  { name: 'desktop-scheduled-tasks', url: 'https://code.claude.com/docs/en/desktop-scheduled-tasks' },
  { name: 'ultraplan', url: 'https://code.claude.com/docs/en/ultraplan' },
  // Auto-discovered from llms.txt (2026-04-09)
  { name: 'web-quickstart', url: 'https://code.claude.com/docs/en/web-quickstart' },
  // Auto-discovered from llms.txt (2026-04-15)
  { name: 'routines', url: 'https://code.claude.com/docs/en/routines' },
  // Auto-discovered from llms.txt (2026-04-17)
  { name: 'errors', url: 'https://code.claude.com/docs/en/errors' },
  { name: 'plugin-dependencies', url: 'https://code.claude.com/docs/en/plugin-dependencies' },
  { name: 'ultrareview', url: 'https://code.claude.com/docs/en/ultrareview' },
  // Auto-discovered from llms.txt (2026-04-25)
  { name: 'admin-setup', url: 'https://code.claude.com/docs/en/admin-setup' },
  { name: 'auto-mode-config', url: 'https://code.claude.com/docs/en/auto-mode-config' },
  { name: 'debug-your-config', url: 'https://code.claude.com/docs/en/debug-your-config' },
  // Auto-discovered from llms.txt (2026-05-02)
  { name: 'champion-kit', url: 'https://code.claude.com/docs/en/champion-kit' },
  { name: 'communications-kit', url: 'https://code.claude.com/docs/en/communications-kit' },
  { name: 'glossary', url: 'https://code.claude.com/docs/en/glossary' },
  { name: 'troubleshoot-install', url: 'https://code.claude.com/docs/en/troubleshoot-install' },
  // Auto-discovered from llms.txt (2026-05-08)
  { name: 'deep-links', url: 'https://code.claude.com/docs/en/deep-links' },
  // Auto-discovered from llms.txt (2026-05-12)
  { name: 'agent-view', url: 'https://code.claude.com/docs/en/agent-view' },
  { name: 'agents', url: 'https://code.claude.com/docs/en/agents' },
  { name: 'claude-platform-on-aws', url: 'https://code.claude.com/docs/en/claude-platform-on-aws' },
  { name: 'goal', url: 'https://code.claude.com/docs/en/goal' },
  { name: 'worktrees', url: 'https://code.claude.com/docs/en/worktrees' },
  // Auto-discovered from llms.txt (2026-05-16)
  { name: 'desktop-changelog', url: 'https://code.claude.com/docs/en/desktop-changelog' },
  // Auto-discovered from llms.txt (2026-05-22)
  { name: 'managed-mcp', url: 'https://code.claude.com/docs/en/managed-mcp' },
  { name: 'plugin-hints', url: 'https://code.claude.com/docs/en/plugin-hints' },
  { name: 'prompt-caching', url: 'https://code.claude.com/docs/en/prompt-caching' },
  { name: 'prompt-library', url: 'https://code.claude.com/docs/en/prompt-library' },
  { name: 'sandbox-environments', url: 'https://code.claude.com/docs/en/sandbox-environments' },
  { name: 'sessions', url: 'https://code.claude.com/docs/en/sessions' },
  // Auto-discovered from llms.txt (2026-05-29)
  { name: 'large-codebases', url: 'https://code.claude.com/docs/en/large-codebases' },
  { name: 'security-guidance', url: 'https://code.claude.com/docs/en/security-guidance' },
  { name: 'workflows', url: 'https://code.claude.com/docs/en/workflows' },
  // Auto-discovered from llms.txt (2026-06-02)
  { name: 'mcp-quickstart', url: 'https://code.claude.com/docs/en/mcp-quickstart' },
  // Auto-discovered from llms.txt (2026-06-23)
  { name: 'advisor', url: 'https://code.claude.com/docs/en/advisor' },
  { name: 'artifacts', url: 'https://code.claude.com/docs/en/artifacts' },
  { name: 'plugin-relevance', url: 'https://code.claude.com/docs/en/plugin-relevance' },
  // Auto-discovered from llms.txt (2026-07-15)
  { name: 'accessibility', url: 'https://code.claude.com/docs/en/accessibility' },
  { name: 'claude-apps-gateway', url: 'https://code.claude.com/docs/en/claude-apps-gateway' },
  { name: 'claude-apps-gateway-config', url: 'https://code.claude.com/docs/en/claude-apps-gateway-config' },
  { name: 'claude-apps-gateway-deploy', url: 'https://code.claude.com/docs/en/claude-apps-gateway-deploy' },
  { name: 'claude-apps-gateway-on-gcp', url: 'https://code.claude.com/docs/en/claude-apps-gateway-on-gcp' },
  { name: 'claude-apps-gateway-spend-limits', url: 'https://code.claude.com/docs/en/claude-apps-gateway-spend-limits' },
  { name: 'desktop-linux', url: 'https://code.claude.com/docs/en/desktop-linux' },
  { name: 'desktop-wsl', url: 'https://code.claude.com/docs/en/desktop-wsl' },
  { name: 'feature-availability', url: 'https://code.claude.com/docs/en/feature-availability' },
  { name: 'gateways', url: 'https://code.claude.com/docs/en/gateways' },
  { name: 'llm-gateway-connect', url: 'https://code.claude.com/docs/en/llm-gateway-connect' },
  { name: 'llm-gateway-protocol', url: 'https://code.claude.com/docs/en/llm-gateway-protocol' },
  { name: 'llm-gateway-rollout', url: 'https://code.claude.com/docs/en/llm-gateway-rollout' },
  // Auto-discovered from llms.txt (2026-07-17)
  { name: 'corporate-launcher', url: 'https://code.claude.com/docs/en/corporate-launcher' },
  // Auto-discovered from llms.txt (2026-07-18)
  { name: 'mobile', url: 'https://code.claude.com/docs/en/mobile' },
  // Agent SDK (different domain)
  { name: 'agent-sdk-overview', url: 'https://platform.claude.com/docs/en/agent-sdk/overview' },
]

// ============================================================
// Category → Doc Page Mapping
// ============================================================

/** Category to doc page mapping (used by verify-state.mjs and fetch-docs.mjs). */
export const CATEGORY_DOC_MAP = {
  memory: ['memory', 'best-practices', 'settings', 'server-managed-settings'],
  skills: ['skills', 'sub-agents', 'best-practices', 'agent-teams'],
  tools: ['how-claude-code-works', 'interactive-mode', 'sub-agents', 'vs-code', 'jetbrains'],
  commands: [
    'interactive-mode',
    'cli-reference',
    'common-workflows',
    'headless',
    'github-actions',
    'gitlab-ci-cd',
    'scheduled-tasks',
    'data-usage',
  ],
  extensions: [
    'mcp',
    'hooks',
    'hooks-guide',
    'discover-plugins',
    'plugins',
    'plugins-reference',
    'plugin-marketplaces',
    'settings',
    'chrome',
    'slack',
    'plugin-relevance',
  ],
  session: [
    'how-claude-code-works',
    'common-workflows',
    'checkpointing',
    'settings',
    'model-config',
    'sandboxing',
    'fast-mode',
    'remote-control',
    'desktop',
    'devcontainer',
    'agent-view',
    'data-usage',
    'gateways',
    'llm-gateway-connect',
    'llm-gateway-protocol',
    'llm-gateway-rollout',
    'desktop-linux',
    'desktop-wsl',
    'feature-availability',
    'claude-apps-gateway',
    'corporate-launcher',
    'mobile',
    'claude-apps-gateway-config',
    'claude-apps-gateway-spend-limits',
  ],
  keyboard: [
    'interactive-mode',
    'common-workflows',
    'keybindings',
    'statusline',
    'terminal-config',
    'output-styles',
    'accessibility',
  ],
  bestpractices: ['best-practices', 'model-config', 'common-workflows', 'sandboxing', 'advisor', 'artifacts'],
  sdk: [
    'agent-sdk-overview',
    'authentication',
    'overview',
    'quickstart',
    'interactive-mode',
    'third-party-integrations',
  ],
}

/** Supplementary doc URLs (used by verify-state.mjs). */
export const SUPPLEMENTARY_DOCS = [
  'settings',
  'permissions',
  'overview',
  'agent-sdk-overview',
  'setup',
  'features-overview',
  'desktop-quickstart',
  'authentication',
]

// ============================================================
// Struggle Detection (shared by session-analysis.mjs, realtime-struggle.mjs)
// ============================================================

/** Frustration keyword regex for struggle signal detection. */
export const FRUSTRATION_REGEX =
  /なぜ|どうして|違う|おかしい|壊れ|動かない|エラー|失敗|ダメ|うまくいかない|wrong|broken|doesn't work|failed|error/i

// ============================================================
// Session Analysis Keywords (used by collect-session.mjs, session-analysis.mjs)
// ============================================================

/** Category → keyword mapping for session prompt scoring. */
export const CATEGORY_KEYWORDS = {
  memory: ['CLAUDE.md', 'claude.md', 'memory', 'MEMORY.md', '/memory', '/init', 'rules/', '@import'],
  skills: ['skill', 'SKILL.md', '/batch', '/loop', '/schedule', 'context: fork', 'frontmatter'],
  tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'tool_use'],
  commands: [
    '/compact',
    '/clear',
    '/resume',
    '/model',
    '/context',
    '/branch',
    '/voice',
    '/rewind',
    'claude -p',
    '--bare',
  ],
  extensions: ['MCP', 'mcp', 'hook', 'Hook', 'plugin', 'subagent', 'Agent', 'Chrome', 'Slack'],
  session: ['コンテキスト', 'token', 'compact', 'checkpoint', 'resume', 'session', 'fork', 'worktree', 'effort'],
  keyboard: ['Ctrl+', 'Shift+', 'Alt+', 'Esc', 'Tab', 'shortcut', 'vim', 'keybind'],
  bestpractices: ['plan mode', 'Plan', 'verify', 'test', 'review', 'IMPORTANT', 'best practice'],
  sdk: [
    'Agent SDK',
    'Anthropic API',
    'Claude API',
    '@anthropic-ai/sdk',
    '@anthropic-ai/claude-agent-sdk',
    'messages.create',
    'Anthropic Console',
    'Workbench',
    'Managed Agents',
    'API キー',
    'API Key',
  ],
}

/** Topic → keyword mapping for session topic detection. */
export const TOPIC_KEYWORDS = {
  'CLAUDE.mdの書き方': ['CLAUDE.md', '/init', 'ルール', '指示'],
  コンテキスト管理: ['コンテキスト', '/compact', '/clear', 'context', '圧縮'],
  MCP: ['MCP', 'mcp', 'ツール連携', 'stdio'],
  Hooks: ['hook', 'Hook', 'フック', 'PreToolUse', 'PostToolUse'],
  サブエージェント: ['subagent', 'サブエージェント', 'Agent', 'worktree', '並列'],
  Skills: ['skill', 'SKILL.md', 'スキル', 'frontmatter'],
  デバッグ: ['debug', 'デバッグ', 'エラー', 'error', 'バグ'],
  テスト: ['test', 'テスト', 'vitest', 'playwright'],
  'CI/CD': ['CI', 'GitHub Actions', 'deploy', 'デプロイ'],
  セキュリティ: ['security', 'セキュリティ', 'permission', 'sandbox'],
  コスト管理: ['cost', 'コスト', '料金', 'effort'],
}

// ============================================================
// URL Validation
// ============================================================

/** Primary domain prefix for referenceUrl validation in quiz-lint. */
export const DOC_URL_PREFIX = 'https://code.claude.com/docs/'

/** Additional valid domain prefixes for referenceUrl (e.g. related docs sites). */
export const ADDITIONAL_DOC_PREFIXES = ['https://platform.claude.com/docs/']

// ============================================================
// Backtick-Lint Term Lists
// ============================================================

/**
 * Terms that should ALWAYS be wrapped in backticks when appearing
 * outside of an existing backtick span in quiz text fields.
 */
export const BACKTICK_TERMS = {
  /** File paths & config files — sorted by length descending to match longer paths first. */
  filePaths: [
    '~/.claude/settings.json',
    '~/.claude/CLAUDE.md',
    '~/.claude/commands/',
    '~/.claude/skills/',
    '.claude/settings.json',
    '.claude/commands/',
    '.claude/rules/',
    '.claude/skills/',
    '.claude/tmp/',
    'CLAUDE.local.md',
    'CLAUDE.md',
    'settings.json',
    'package.json',
    '.gitignore',
    '.clauderc',
    '.mcp.json',
  ].sort((a, b) => b.length - a.length),

  /** Slash commands regex pattern. */
  slashCommands:
    /(?<!`|[/\w])(\/(init|memory|compact|clear|rewind|status|model|config|hooks|login|logout|bug|review|terminal-setup|teleport|doctor|cost|vim|rename|todos|tasks|search|ide|project|help|mcp|diff|permissions|listen))(?![-\w]|`)/g,

  /** Hook event names (PascalCase). */
  hookEvents: [
    'PreToolUse',
    'PostToolUse',
    'UserPromptSubmit',
    'Stop',
    'SubagentStop',
    'SessionStart',
    'SessionEnd',
    'Notification',
    'PermissionRequest',
    'TeammateIdle',
    'TaskCompleted',
    'ConfigChange',
    'WorktreeCreate',
  ],

  /** Built-in tool names (Agent/Task excluded — too many false positives with "Agent SDK" etc.). */
  toolNames: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite'],

  /** Config keys (camelCase / kebab-case identifiers from settings) — sorted by length descending. */
  configKeys: [
    'allowed-tools',
    'allowedTools',
    'context: fork',
    'defaultMode',
    'allowManagedHooksOnly',
    'permissions.deny',
    'permissions.allow',
    'spinnerVerbs.mode',
    'spinnerVerbs.verbs',
    'spinnerVerbs',
    'deniedMcpServers',
    'allowedMcpServers',
    'alwaysThinkingEnabled',
    'availableModels',
    'hookSpecificOutput',
  ].sort((a, b) => b.length - a.length),

  /** CLI commands (full invocations) — longer patterns first to match greedily. */
  cliCommands: [
    'git reset --hard',
    'git worktree remove',
    'brew install --cask claude-code',
    'npm test',
    'npm install',
    'npm run',
    'git commit',
    'git push',
    'git stash',
    'git reset',
    'git worktree',
    'claude --resume',
    'claude --continue',
    'claude --review',
    'claude --teleport',
    'claude install-mcp',
    'nvm use',
  ],
}

// ============================================================
// Terminology Dictionary
// ============================================================

/**
 * Known incorrect terms -> correct terms.
 * Built from known-issues.md and verified facts in MEMORY.md.
 */
export const TERMINOLOGY_DICT = [
  // Official names
  { wrong: 'Azure Foundry', correct: 'Microsoft Foundry', caseInsensitive: false },
  // "Claude Code SDK" — skip if context is clearly historical (e.g., "旧称", "以前は")
  { wrong: 'Claude Code SDK', correct: 'Claude Agent SDK', caseInsensitive: false, skipIfHistorical: true },
  // Non-existent commands/features (only flag in explanation, not in wrong-answer options)
  // skipIfNegated: true — explanations that legitimately teach "X does not exist"
  //   have to quote X; don't flag them when "存在しません" / "does not exist" is nearby.
  {
    wrong: 'claude commit',
    correct: null,
    message: '`claude commit` サブコマンドは存在しません',
    skipWrongOptions: true,
    skipIfNegated: true,
  },
  {
    wrong: /(?<!`)\/teleport(?!`)/,
    correct: null,
    message: '`/teleport` はスラッシュコマンドではなく `claude --teleport` CLIフラグです',
    skipWrongOptions: true,
    skipIfNegated: true,
  },
  // Terminology precision
  { wrong: 'allowed_tools', correct: 'allowed-tools', caseInsensitive: false },
  // Common misspellings in Japanese context
  { wrong: 'Exntended Thinking', correct: 'Extended Thinking', caseInsensitive: false },
  // Deprecated terminology
  {
    wrong: /(?<!\w)Task\s+tool(?!\w)/i,
    correct: null,
    message: 'CLI では Agent ツールに改名済み（SDK の allowedTools では Task を使用）',
  },
]

// ============================================================
// Negation detection (shared by quiz-lint, quiz-fact-check, pre-lint)
// ============================================================

/**
 * Patterns that indicate a term is being used in a negation context
 * (e.g. "does not exist"). When a term match falls inside a ~40-char
 * window of these markers, lint checks suppress the flag so quizzes
 * that teach "X does not exist" don't get flagged for quoting X.
 *
 * Single source of truth — edits here propagate to every lint script
 * via import. Don't duplicate this regex; import this constant and
 * (optionally) isInNegationWindow instead.
 */
export const NEGATION_MARKERS =
  /存在しません|存在しない|ありません|ではない|ではなく|サポートされていない|未提供|未サポート|does not exist|is not (a|an) |isn't a[n ]|no such/i

/**
 * Returns true if the term's first occurrence in `text` sits within
 * `windowChars` of a negation marker (before or after).
 */
export function isInNegationWindow(text, term, windowChars = 40) {
  const idx = typeof text === 'string' ? text.indexOf(term) : -1
  if (idx < 0) return false
  const start = Math.max(0, idx - windowChars)
  const end = idx + term.length + windowChars
  return NEGATION_MARKERS.test(text.slice(start, end))
}

// ============================================================
// Known-nonexistent terms (error when used without negation)
// ============================================================

/**
 * Features that genuinely don't exist in Claude Code. If a quiz mentions
 * them in a positive context (no negation marker nearby), that's a
 * factual error in the quiz — not just a style issue.
 *
 * quiz-fact-check.mjs checks this list after the normal "term-not-in-docs"
 * sweep to catch the reverse pattern: the term happens to appear in a doc
 * fragment but the quiz is still using it as if it were a real feature.
 */
export const KNOWN_NONEXISTENT_TERMS = [
  { term: 'claude commit', reason: 'CLI サブコマンドではない（git commit を直接使う）' },
  { term: '/summarize', reason: '存在しない。/rewind の "Summarize from here" に統合済み' },
  { term: '/todos', reason: 'commands.md から削除済み（/tasks に統合）' },
  { term: 'Azure Foundry', reason: '正式名称は "Microsoft Foundry"' },
]
