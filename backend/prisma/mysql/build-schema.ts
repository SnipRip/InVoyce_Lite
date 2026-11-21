// Builds prisma/mysql/schema.prisma from prisma/schema.prisma, and the MySQL
// migration that takes the previous MySQL schema to the new one.
//
// prisma/schema.prisma (PostgreSQL) is the one data model. After changing it
// and running `npm run db:migrate` against PostgreSQL, run
//
//   npm run db:mysql-schema -- <migration_name>
//
// and commit both schemas and both migrations. Nothing here needs a
// database: the SQL comes from `prisma migrate diff` between schema files.
//
// What changes for MySQL / MariaDB:
// - uuid columns become CHAR(36);
// - a String that is not a key, unique, index or foreign key becomes TEXT
//   (PostgreSQL text has no length; MySQL's default VARCHAR(191) does);
// - defaults on TEXT and JSON columns are written as expressions,
//   DEFAULT ('…'), the form both MySQL 8 and MariaDB accept (Prisma leaves
//   JSON defaults out of MySQL DDL altogether).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'schema.prisma');
const TARGET = join(here, 'schema.prisma');
const MIGRATIONS = join(here, 'migrations');

const HEADER = `// GENERATED from ../schema.prisma by build-schema.ts (npm run db:mysql-schema).
// Do not edit: change ../schema.prisma and run the script again.
`;

interface JsonDefault {
  model: string;
  field: string;
  value: string;
}

/** Field names listed in a block attribute, e.g. @@index([a, b(sort: Desc)], map: "x") → a, b. */
function listedFields(line: string): string[] {
  const match = /\[([^\]]*)\]/.exec(line);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((part) => part.trim().replace(/\(.*$/, ''))
    .filter(Boolean);
}

export function toMysqlSchema(source: string): { schema: string; jsonDefaults: JsonDefault[] } {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const jsonDefaults: JsonDefault[] = [];
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const modelStart = /^model (\w+) \{/.exec(line);
    if (!modelStart) {
      out.push(line);
      i++;
      continue;
    }
    // Collect the whole model, then decide which strings are keys.
    const model = modelStart[1];
    const block: string[] = [line];
    i++;
    while (i < lines.length && lines[i] !== '}') block.push(lines[i++]);
    block.push(lines[i++] ?? '}');

    const keyed = new Set<string>();
    for (const row of block) {
      const code = row.replace(/\/\/.*$/, '');
      if (/^\s*@@(id|unique|index)\(/.test(code)) listedFields(code).forEach((field) => keyed.add(field));
      const relation = /@relation\([^)]*fields:\s*\[([^\]]*)\]/.exec(code);
      if (relation) relation[1].split(',').forEach((field) => keyed.add(field.trim()));
      const field = /^\s+(\w+)\s+\S/.exec(code);
      if (field && /@(id|unique)\b/.test(code)) keyed.add(field[1]);
    }

    for (const row of block) {
      const comment = row.indexOf('//');
      const code = comment === -1 ? row : row.slice(0, comment);
      const tail = comment === -1 ? '' : row.slice(comment);
      const field = /^(\s+)(\w+)(\s+)(\w+)(\??)(.*)$/.exec(code);
      if (!field || code.trim().startsWith('@@')) {
        out.push(row);
        continue;
      }
      const [, , name, , type] = field;
      let rewritten = code.replace(/@db\.Uuid\b/, '@db.Char(36)');
      if (type === 'String' && !keyed.has(name) && !/@db\./.test(rewritten)) {
        rewritten = `${rewritten.trimEnd()} @db.Text${comment === -1 ? '' : ' '}`;
      }
      if (type === 'Json') {
        const value = /@default\("((?:[^"\\]|\\.)*)"\)/.exec(rewritten);
        if (value) jsonDefaults.push({ model, field: name, value: value[1].replace(/\\"/g, '"') });
      }
      out.push(rewritten + tail);
    }
  }
  const schema = out
    .join('\n')
    .replace('provider = "postgresql"', 'provider = "mysql"')
    .replace('output   = "../src/generated/prisma"', 'output   = "../../src/generated/prisma"');
  return { schema: HEADER + schema, jsonDefaults };
}

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** DEFAULT 'x' on TEXT becomes DEFAULT ('x'); JSON columns get the default Prisma left out. */
export function fixDefaults(sql: string, jsonDefaults: JsonDefault[]): string {
  let fixed = sql.replace(/\b(TEXT|MEDIUMTEXT|LONGTEXT)( NOT NULL| NULL)? DEFAULT ('(?:[^']|'')*')/g, '$1$2 DEFAULT ($3)');
  for (const { model, field, value } of jsonDefaults) {
    // In CREATE TABLE `Model` … and in ALTER TABLE `Model` ADD COLUMN / MODIFY.
    const table = new RegExp(String.raw`((?:CREATE|ALTER) TABLE \`${model}\`[^;]*?)(\`${field}\` JSON(?: NOT NULL| NULL)?)(?! DEFAULT)`, 'g');
    fixed = fixed.replace(table, (_all, before: string, column: string) => `${before}${column} DEFAULT (${sqlString(value)})`);
  }
  return fixed;
}

function prismaDiff(from: string | null, to: string): string {
  const cli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  const args = [cli, 'migrate', 'diff', ...(from ? ['--from-schema', from] : ['--from-empty']), '--to-schema', to, '--script'];
  return execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function main() {
  const name = (process.argv[2] ?? '').trim().replace(/[^A-Za-z0-9_]+/g, '_');
  const { schema, jsonDefaults } = toMysqlSchema(readFileSync(SOURCE, 'utf8'));
  const previous = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : null;
  if (previous === schema) {
    console.log('prisma/mysql/schema.prisma is up to date; no migration needed.');
    return;
  }
  if (!name) throw new Error('Name the MySQL migration: npm run db:mysql-schema -- <migration_name>');

  const scratch = mkdtempSync(join(tmpdir(), 'ivl-mysql-'));
  const before = previous === null ? null : join(scratch, 'before.prisma');
  if (before && previous !== null) writeFileSync(before, previous);
  writeFileSync(TARGET, schema);

  const sql = fixDefaults(prismaDiff(before, TARGET), jsonDefaults).trim();
  if (!sql) {
    console.log('The schemas differ only in comments: prisma/mysql/schema.prisma updated, no migration needed.');
    return;
  }
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const folder = join(MIGRATIONS, `${stamp}_${name}`);
  mkdirSync(folder, { recursive: true });
  // The first migration also carries the partial-index stand-ins and the
  // starting rows the PostgreSQL migrations insert (export-reference-data.ts).
  const extra = previous === null ? ['init-extra.sql', 'reference-data.sql'].map((file) => readFileSync(join(here, file), 'utf8').trim()).join('\n\n') + '\n' : '';
  writeFileSync(join(folder, 'migration.sql'), `${sql}\n${extra ? `\n${extra}` : ''}`);
  writeFileSync(join(MIGRATIONS, 'migration_lock.toml'), '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "mysql"\n');
  console.log(`Wrote prisma/mysql/schema.prisma and ${folder}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
