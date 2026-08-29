/**
 * LibreDB the database — the second product, and the one the site had stopped
 * mentioning entirely.
 *
 * The previous site gave it three pages (/database, /database-architecture,
 * /database-reliability); the redesign shipped none, which left the playground
 * running an engine the site never named and the npm package with no page to
 * link to. It is one page here, because three pages on an early-beta product
 * was three times the surface and one third of the depth.
 *
 * NAMING. The route is /libredb-database, not /database: the old /database sat
 * one letter from /databases, which is the list of engines Studio connects to,
 * and the two pages were about different products. That pair was a genuine
 * navigation trap and the redesign is the moment to stop paying for it.
 *
 * SOURCE OF TRUTH: libredb-database → README.md, MANIFESTO.md and
 * docs/RELIABILITY.md. The refusals below are quoted as refusals on purpose —
 * the project's own framing is that its strength is what it declines to do,
 * and softening them into "coming soon" would misrepresent an early beta to
 * someone deciding whether to put data in it.
 */

const REPO = 'https://github.com/libredb/libredb-database';

export const meta = {
  /** Matches the version the README's own CDN example pins. */
  version: '0.2.2',
  status: 'Early beta · MIT · zero dependencies',
  repo: REPO,
  npm: 'https://www.npmjs.com/package/@libredb/libredb',
  jsr: 'https://jsr.io/@libredb/libredb',
  reliabilityDocs: `${REPO}/blob/main/docs/RELIABILITY.md`,
  manifesto: `${REPO}/blob/main/MANIFESTO.md`,
};

export const intro =
  'LibreDB is a small, readable, embeddable, multi-model database written in TypeScript. One ordered key-value kernel handles durability and transactions; key-value, document and relational are thin lenses over that one core rather than three engines bolted together. It runs in memory for tests or file-backed for durability, ships zero runtime dependencies, and proves its crash recovery instead of asserting it.';

/** The three-lens example, verbatim in shape from the README's quick start. */
export const sample = `import { open, kv, doc, table } from "@libredb/libredb";

// In-memory for tests, or open({ path: "data.libredb" }) for a durable file.
const db = open();

// 1. Key-value: a durable, ordered, string-keyed map.
const cache = kv(db);
cache.set("user:1", "Ada");

// 2. Document: JSON documents under string ids.
const logs = doc(db, "logs");
logs.put("l1", { level: "info", message: "started", at: 1 });
logs.find({ level: "info" }).toArray();

// 3. Relational: a schema-validated, typed table.
const users = table(db, "users", {
  primaryKey: "id",
  columns: { id: "string", name: "string", age: "number" },
});
users.insert({ id: "1", name: "Ada", age: 36 });
users.where({ name: "Ada" }).select("id", "age").toArray();

db.close();`;

export interface Trait {
  title: string;
  detail: string;
}

export const architecture: Trait[] = [
  {
    title: 'One kernel, not three engines',
    detail:
      'A single ordered byte key-value kernel in one file. A relational table is physically a document collection, which is physically ordered key-value entries under composite keys like users:42 — so the three APIs cannot disagree about what is stored.',
  },
  {
    title: 'One filesystem seam',
    detail:
      'The kernel reaches disk through a single injectable filesystem interface. That seam is what makes the browser build work with no node: imports, and it is the same seam the crash tests use to tear the log on command.',
  },
  {
    title: 'Readable on purpose',
    detail:
      'The kernel is under a thousand lines, roughly half of it explanatory prose. The claim is not that it is short — it is that you can open it and learn how a database actually works.',
  },
  {
    title: 'Nothing hidden',
    detail:
      'Queries are plain in-engine scans, errors surface rather than being swallowed, and the costs are visible: O(n) scans and no secret indexes. Under 6 kB min+brotli, ESM only, full types shipped.',
  },
];

export const reliability: Trait[] = [
  {
    title: 'Committed means fsynced',
    detail:
      'A transaction that returns has been written to a length-framed, CRC-32-checksummed write-ahead log and fsynced before the commit becomes visible. On a healthy disk a committed write survives a crash, and a crash can only damage the last un-fsynced record — which recovery detects, truncates and reports.',
  },
  {
    title: 'The dirty failures are handled, not assumed away',
    detail:
      'A failed append or fsync latches the database rather than writing past a torn record. A second writer is refused by an exclusive lock instead of silently corrupting the file. A file that is not a LibreDB database is refused untouched via its LRDB header, mid-log corruption refuses to open rather than quietly truncating, and a short read is an IO error, never data loss.',
  },
  {
    title: 'Proven, not asserted',
    detail:
      'The crash and recovery path is exercised by deterministic simulation testing — the real engine against a seeded in-memory filesystem that tears, corrupts, errors and crashes the log on command — plus a binary round-trip fuzz, on top of 100% line coverage of the core.',
  },
];

/**
 * Published as refusals, in the project's own framing. An early beta that is
 * vague about its ceiling costs someone a production incident.
 */
export const fitFor = [
  'Backing tests and local development with a real durable store instead of mocks.',
  'Embedding a small database directly in a TypeScript, Bun or Node app with zero infrastructure.',
  'Prototyping across key-value, document and relational shapes without standing up three systems.',
  'Learning how a database works by reading — and changing — a small, honest codebase.',
];

export const notFor = [
  'A hardened production datastore at scale. It is an early beta; the beachhead is test and dev.',
  'Secondary indexes or a query planner — a find or where is an O(n) scan by design in v1.',
  'Concurrent multi-process access, replication, or a networked client/server. It is embedded, in-process and strictly single-writer.',
  'SQL wire compatibility or an existing driver ecosystem.',
];
