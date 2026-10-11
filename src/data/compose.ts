/**
 * The environment-variable reference behind /docker-compose.
 *
 * SOURCE OF TRUTH is `src/data/docker-compose.example.yml`, which is
 * libredb-studio's `docker-compose.example.yml` at the tag in `upstreamCompose`
 * with the comment lines listed there corrected, and nothing else changed (the
 * studio repo is not edited from here, so a false comment is fixed in this copy
 * and listed). This file only describes
 * what is in there — it must never introduce a variable the compose file does not
 * mention, and must never omit one it does. `tests/compose.test.ts` checks both
 * directions, so a drifting copy fails the gate rather than shipping a table that
 * documents a variable the image ignores.
 *
 * `state` is where the variable sits in the file: 'active' lines ship uncommented
 * and take effect on `docker compose up`; 'commented' lines are there to be
 * uncommented. The distinction matters — someone reading the table alone would
 * otherwise assume STORAGE_SQLITE_PATH is already in force.
 */

export interface ComposeVar {
  name: string;
  /** what the file resolves to when the variable is unset, or 'required' */
  def: string;
  desc: string;
  state: 'active' | 'commented';
}

export interface ComposeGroup {
  id: string;
  title: string;
  /** one line of framing, shown under the group heading */
  note: string;
  vars: ComposeVar[];
}

export const composeGroups: ComposeGroup[] = [
  {
    id: 'auth',
    title: 'Authentication',
    note: 'The local email/password provider. This compose file refuses to start until ADMIN_PASSWORD and JWT_SECRET are set in .env. Studio on its own generates both on first start and prints the admin password to the log once; the file asks for them so the values are yours.',
    vars: [
      {
        name: 'ADMIN_EMAIL',
        def: 'admin@libredb.org',
        desc: 'Admin login — full access plus the maintenance tools.',
        state: 'active',
      },
      {
        name: 'ADMIN_PASSWORD',
        def: 'required',
        desc: 'Admin password. Unset, docker compose up stops with an error before the container starts.',
        state: 'active',
      },
      {
        name: 'USER_EMAIL',
        def: 'user@libredb.org',
        desc: 'Optional lower-privilege account — query execution only, no maintenance.',
        state: 'active',
      },
      {
        name: 'USER_PASSWORD',
        def: 'empty',
        desc: 'Leave it unset to run admin-only. No default user password is ever assumed.',
        state: 'active',
      },
      {
        name: 'JWT_SECRET',
        def: 'required',
        desc: 'Signing secret, minimum 32 characters. Generate one with openssl rand -base64 32.',
        state: 'active',
      },
      {
        name: 'NEXT_PUBLIC_AUTH_PROVIDER',
        def: 'local',
        desc: 'local for email/password, oidc to hand sign-in to your identity provider.',
        state: 'active',
      },
    ],
  },
  {
    id: 'oidc',
    title: 'OIDC single sign-on',
    note: "Only read when NEXT_PUBLIC_AUTH_PROVIDER=oidc. Studio's OIDC guide has setup examples for Auth0, Keycloak, Okta, Microsoft Entra ID and Zitadel. The Keycloak steps are verified on Keycloak 26.4 and ship as a local demo stack; the others are configuration examples, and Okta's logout has not been tried against a live tenant.",
    vars: [
      {
        name: 'OIDC_ISSUER',
        def: '—',
        desc: 'Issuer URL. It must serve /.well-known/openid-configuration.',
        state: 'commented',
      },
      {
        name: 'OIDC_CLIENT_ID',
        def: '—',
        desc: 'Client ID from your identity provider.',
        state: 'commented',
      },
      { name: 'OIDC_CLIENT_SECRET', def: '—', desc: 'Client secret for that client.', state: 'commented' },
      {
        name: 'OIDC_SCOPE',
        def: 'openid profile email',
        desc: 'Scopes requested at sign-in.',
        state: 'commented',
      },
      {
        name: 'OIDC_ROLE_CLAIM',
        def: 'empty',
        desc: 'The claim that carries roles — realm_access.roles on Keycloak, groups on Okta.',
        state: 'commented',
      },
      {
        name: 'OIDC_ADMIN_ROLES',
        def: 'admin',
        desc: 'Which of those roles get admin access.',
        state: 'commented',
      },
    ],
  },
  {
    id: 'storage',
    title: 'Storage',
    note: 'Where saved connections and configuration live. The default keeps them in the browser. A first start also adds two editable sample connections, on by default; .env.example has the switches that turn them off.',
    vars: [
      {
        name: 'STORAGE_PROVIDER',
        def: 'local',
        desc: 'local (browser storage, zero config), sqlite (one server file), or postgres (shared across replicas).',
        state: 'active',
      },
      {
        name: 'STORAGE_SQLITE_PATH',
        def: '/app/data/libredb-storage.db',
        desc: 'Where the SQLite file goes. Mount the data volume too, or it dies with the container.',
        state: 'commented',
      },
      {
        name: 'STORAGE_POSTGRES_URL',
        def: 'postgresql://postgres:postgres@libredb-postgres:5432/libredb_storage?sslmode=disable',
        desc: 'Connection string for the postgres provider. The file ships a matching optional postgres:18 service.',
        state: 'commented',
      },
    ],
  },
  {
    id: 'llm',
    title: 'AI model',
    note: 'Optional. Configure a model here and natural-language querying appears; leave it out and Studio is a plain editor.',
    vars: [
      { name: 'LLM_PROVIDER', def: 'gemini', desc: 'gemini, openai, ollama or custom.', state: 'commented' },
      {
        name: 'LLM_API_KEY',
        def: '—',
        desc: 'Required for gemini and openai. This is the only place Studio reads a model key from.',
        state: 'commented',
      },
      { name: 'LLM_MODEL', def: 'gemini-2.5-flash', desc: 'Model name.', state: 'commented' },
      {
        name: 'LLM_API_URL',
        def: '—',
        desc: 'Required for custom, and read by every provider: an Ollama that is not on localhost:11434, e.g. http://host:11434/v1, or a proxy or regional endpoint for gemini.',
        state: 'commented',
      },
    ],
  },
  {
    id: 'agent',
    title: 'Agent runtime',
    note: 'There is no switch that turns the agent on. It appears once a model is configured above and the ledger path is writable — which means an upgrade can hand an agent to a key you added for natural-language querying.',
    vars: [
      {
        name: 'LIBREDB_AGENT_ENABLED',
        def: 'unset',
        desc: 'Set to "false" to keep the AI configuration and have no agent.',
        state: 'commented',
      },
      {
        name: 'WORKFLOW_TARGET_WORLD',
        def: 'local',
        desc: 'Durable backend for run state. local is file-locked and single-instance; more than one replica needs @workflow/world-postgres.',
        state: 'commented',
      },
      {
        name: 'WORKFLOW_LOCAL_DATA_DIR',
        def: '/app/data/workflow',
        desc: 'Where the local backend writes. If it cannot be created and written, the agent reports itself absent.',
        state: 'commented',
      },
    ],
  },
  {
    id: 'mcp',
    title: 'MCP server',
    note: 'Off unless switched on. An AI client of your own reads schemas and runs read-only SQL at /api/mcp, with a token minted on the settings screen.',
    vars: [
      {
        name: 'LIBREDB_MCP_ENABLED',
        def: 'unset',
        desc: 'true, on or 1 turns the MCP endpoint on; unset leaves it off.',
        state: 'commented',
      },
      {
        name: 'LIBREDB_MCP_URL',
        def: 'http://localhost:3000/api/mcp',
        desc: 'The address clients use, with your BASE_PATH. Every token is bound to it, so changing it invalidates them all.',
        state: 'commented',
      },
      {
        name: 'LIBREDB_MCP_TOKEN_LABEL',
        def: '—',
        desc: 'Any non-empty value. Changing it revokes every MCP token at once.',
        state: 'commented',
      },
      {
        name: 'LIBREDB_MCP_TOKEN_TTL_DAYS',
        def: '30',
        desc: 'How many days a minted token stays valid, from 1 to 365.',
        state: 'commented',
      },
    ],
  },
  {
    id: 'passkeys',
    title: 'Passkeys',
    note: 'Off unless PASSKEY_ORIGIN is set. Needs local sign-in and STORAGE_PROVIDER sqlite or postgres, since the server store keeps the passkey records.',
    vars: [
      {
        name: 'PASSKEY_ORIGIN',
        def: 'http://localhost:3000',
        desc: 'The exact address people open Studio at: scheme, host and port, no path. https is required except on localhost.',
        state: 'commented',
      },
    ],
  },
  {
    id: 'seed',
    title: 'Seed connections',
    note: 'Optional. Ship the team a Studio that already knows the databases, instead of asking everyone to add them by hand.',
    vars: [
      {
        name: 'SEED_CONFIG_PATH',
        def: '/app/config/seed-connections.yaml',
        desc: 'A mounted YAML file of connections to register on boot. Credentials inside it interpolate from the same .env.',
        state: 'commented',
      },
      { name: 'SEED_CACHE_TTL_MS', def: '60000', desc: 'How long seeded connections are cached.', state: 'commented' },
    ],
  },
];

/** Four lines from nothing to a login screen. */
export const composeQuickStart = `curl -O https://libredb.org/docker-compose.example.yml
mv docker-compose.example.yml docker-compose.yml
printf 'ADMIN_PASSWORD=change-me\\nJWT_SECRET=%s\\n' "$(openssl rand -base64 32)" > .env
docker compose up -d`;

/**
 * The site copy against upstream. Every line that differs from libredb-studio's
 * file at `tag` is listed here, and each one is a comment that was false at that
 * tag. tests/compose.test.ts puts the upstream text back, hashes the result and
 * compares it with `sha256` (the upstream file's own hash), so any other edit,
 * functional or not, fails the gate. When the upstream file changes: copy it,
 * re-apply only the corrections still needed, and update `tag` and `sha256`.
 */
export const upstreamCompose = {
  tag: '0.18.2',
  sha256: '305c389ed153de7c9c1244fc62b1a3cf5d906bbab165f627a5ad006561963d85',
  corrections: [
    {
      line: 14,
      upstream: '# Every supported environment variable is listed below. Commonly-used ones are',
      site: '# The variables most deployments use are listed below; .env.example has the rest.',
      why: 'The file lists a subset of what Studio reads; .env.example is the full set.',
    },
    {
      line: 15,
      upstream: '# active; less-frequently-used ones are shown commented out — uncomment as needed.',
      site: '# Commonly-used ones are active; others are commented out — uncomment as needed.',
      why: 'Rewrapped with line 14.',
    },
    {
      line: 33,
      upstream: '      # AUTHENTICATION — local provider. ADMIN_PASSWORD is required (without it',
      site: '      # AUTHENTICATION — local provider. ADMIN_PASSWORD is required here (without',
      why: 'Rewrapped with line 34.',
    },
    {
      line: 34,
      upstream: '      # the login screen shows a clear config error); USER_* is optional.',
      site: '      # it docker compose refuses to start); USER_* is optional.',
      why: 'The file uses ${ADMIN_PASSWORD:?}, so compose stops before the container starts; Studio itself would generate a password (.env.example, ZERO-CONFIG BOOTSTRAP).',
    },
    {
      line: 75,
      upstream: '      # LLM_API_URL: ${LLM_API_URL}                # ollama/custom only, e.g. http://host:11434/v1',
      site: '      # LLM_API_URL: ${LLM_API_URL}                # required for custom, read by every provider, e.g. http://host:11434/v1',
      why: '.env.example: "required for the custom provider, and read by every kind" (Gemini reads it for a proxy or regional endpoint).',
    },
    {
      line: 129,
      upstream: "    # Image runs as node:24.16.0-trixie-slim (no curl/wget) — use Node's built-in fetch.",
      site: "    # Image runs as node:26.10.0-trixie-slim (no curl/wget) — use Node's built-in fetch.",
      why: 'The Dockerfile at 0.18.2 builds the runner FROM node:26.10.0-trixie-slim.',
    },
  ],
} as const;
