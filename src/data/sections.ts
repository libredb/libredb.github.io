import { deployTargets } from './deploy-targets';

/**
 * Section manifest — the single source of truth for the "schema explorer".
 * Each section is a table; selecting it runs `query` and renders its content
 * as a result set. Drives the Explorer tree, the desktop query chrome, and the
 * mobile per-section query cards.
 */
export interface SectionColumn {
  name: string;
  type: string; // SQL-ish type shown in the explorer tree
}

export interface SectionMeta {
  id: string;          // anchor id + data-section key
  table: string;       // table name shown in explorer + {table}.sql tab
  query: string;       // SQL shown in the editor (highlighted by <Sql/>)
  rows: number;        // result row count
  cols: number;        // result column count
  execMs: number;      // fake exec time badge
  columns: SectionColumn[];
}

export const sections: SectionMeta[] = [
  {
    id: 'home',
    table: 'home',
    query: 'SELECT * FROM libredb_studio;',
    rows: 1,
    cols: 3,
    execMs: 3,
    columns: [
      { name: 'headline', type: 'TEXT' },
      { name: 'tagline', type: 'TEXT' },
      { name: 'stats', type: 'JSONB' },
    ],
  },
  {
    id: 'features',
    table: 'features',
    query: 'SELECT name, category, summary FROM features ORDER BY category;',
    rows: 17,
    cols: 3,
    execMs: 4,
    columns: [
      { name: 'name', type: 'VARCHAR' },
      { name: 'category', type: 'ENUM' },
      { name: 'summary', type: 'TEXT' },
    ],
  },
  {
    id: 'databases',
    table: 'databases',
    query: 'SELECT name, type, driver FROM databases;',
    rows: 7,
    cols: 3,
    execMs: 2,
    columns: [
      { name: 'name', type: 'VARCHAR' },
      { name: 'type', type: 'VARCHAR' },
      { name: 'driver', type: 'VARCHAR' },
    ],
  },
  {
    id: 'compare',
    table: 'compare',
    query: 'SELECT * FROM tools ORDER BY freedom DESC;',
    rows: 5,
    cols: 7,
    execMs: 5,
    columns: [
      { name: 'tool', type: 'VARCHAR' },
      { name: 'scores', type: 'BOOL[]' },
      { name: 'price', type: 'VARCHAR' },
    ],
  },
  {
    id: 'tech_stack',
    table: 'tech_stack',
    query: 'SELECT layer, tools FROM tech_stack;',
    rows: 4,
    cols: 2,
    execMs: 3,
    columns: [
      { name: 'layer', type: 'VARCHAR' },
      { name: 'tools', type: 'TEXT[]' },
    ],
  },
  {
    id: 'get_started',
    table: 'get_started',
    query: 'SELECT step, title, command FROM quickstart ORDER BY step;',
    rows: 3,
    cols: 3,
    execMs: 1,
    columns: [
      { name: 'step', type: 'INT' },
      { name: 'title', type: 'VARCHAR' },
      { name: 'command', type: 'TEXT' },
    ],
  },
  {
    id: 'faq',
    table: 'faq',
    query: 'SELECT question, answer FROM faq;',
    rows: 9,
    cols: 2,
    execMs: 2,
    columns: [
      { name: 'question', type: 'TEXT' },
      { name: 'answer', type: 'TEXT' },
    ],
  },
  {
    id: 'deploy',
    table: 'deploy',
    query: 'SELECT platform, category FROM deploy_targets ORDER BY category;',
    rows: deployTargets.length,
    cols: 3,
    execMs: 8,
    columns: [
      { name: 'platform', type: 'VARCHAR' },
      { name: 'category', type: 'VARCHAR' },
      { name: 'method', type: 'VARCHAR' },
    ],
  },
];

export const sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));
