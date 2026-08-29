/**
 * The environment-variable reference behind /docker-compose.
 *
 * SOURCE OF TRUTH is `src/data/docker-compose.example.yml`, which is a verbatim
 * copy of libredb-studio's `docker-compose.example.yml`. This file only describes
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
    note: 'The local email/password provider. Studio will not start a usable login without ADMIN_PASSWORD and JWT_SECRET.',
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
        desc: 'Admin password. Without it the login screen shows a configuration error instead of a form.',
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
    note: 'Only read when NEXT_PUBLIC_AUTH_PROVIDER=oidc. Tested against Auth0, Keycloak, Okta, Microsoft Entra ID and Zitadel.',
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
    note: 'Where saved connections and configuration live. The default keeps them in the browser, so a fresh container starts empty on purpose.',
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
        def: '—',
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
        desc: 'Base URL for ollama and custom, e.g. http://host:11434/v1.',
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
