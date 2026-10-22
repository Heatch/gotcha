import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8').replaceAll('\r\n', '\n');
const sql = read('database/migrations/001_initial.sql');
const mermaid = read('docs/database.mmd');
const columnNames = (text) => text.split(',').map((value) => value.trim());
const tablePattern = /^CREATE TABLE (\w+) \(([\s\S]*?)^\) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;/gm;
const tables = new Map([...sql.matchAll(tablePattern)].map(([, name, body]) => {
  const columns = new Map([...body.matchAll(/^    (\w+) ((?:BINARY|VARCHAR|DATETIME|BIGINT|INT|SMALLINT|TINYINT|BOOLEAN|ENUM|DECIMAL)\b[^\n]*)/gm)]
    .map(([, column, definition]) => [column, definition]));
  const keys = [...body.matchAll(/(PRIMARY KEY|UNIQUE KEY \w+|KEY \w+) \(([^)]+)\)/g)]
    .map(([, kind, fields]) => ({ unique: kind !== 'KEY' && !kind.startsWith('KEY '), columns: columnNames(fields) }));
  const foreignKeys = [...body.matchAll(/CONSTRAINT (\w+) FOREIGN KEY \(([^)]+)\)\s*REFERENCES (\w+) \(([^)]+)\)/g)]
    .map(([, constraint, fields, parent, parentFields]) => ({
      constraint, columns: columnNames(fields), parent, parentColumns: columnNames(parentFields),
    }));
  return [name, { body, columns, keys, foreignKeys }];
}));

const expectedTables = [
  'mission_packs', 'missions', 'games', 'game_settings', 'game_players', 'game_missions',
  'player_slots', 'mission_assignments', 'selection_offers',
  'selection_offer_items', 'player_target_hits', 'game_messages', 'mutation_receipts',
];
const typeOf = (definition) => definition.match(/^\w+(?:\(\d+\))?(?: UNSIGNED)?/)[0];
const hasPrefix = (key, columns) => columns.every((column, index) => key.columns[index] === column);

test('initial migration declares exactly the intended thirteen InnoDB tables', () => {
  assert.deepEqual([...tables.keys()], expectedTables);
  assert.equal([...sql.matchAll(/^CREATE TABLE /gm)].length, tables.size);
  const statements = sql.replace(/^--.*$/gm, '');
  assert.doesNotMatch(statements, /\b(?:CREATE DATABASE|DROP DATABASE|FOREIGN_KEY_CHECKS|ON DELETE CASCADE)\b/i);
  const constraints = [...sql.matchAll(/CONSTRAINT (\w+)/g)].map((match) => match[1]);
  assert.equal(new Set(constraints).size, constraints.length, 'constraint names must be unique');
  for (const name of constraints) assert.ok(name.length <= 64, name);
});

test('declared keys reference existing columns', () => {
  for (const [tableName, table] of tables) {
    assert.ok(table.keys.some((key) => key.unique), tableName);
    for (const key of table.keys) {
      for (const column of key.columns) assert.ok(table.columns.has(column), `${tableName}.${column}`);
    }
  }
});

test('foreign keys have exact unique parent targets, matching types and explicit child indexes', () => {
  const created = new Set();
  for (const [tableName, table] of tables) {
    for (const fk of table.foreignKeys) {
      assert.ok(created.has(fk.parent), `${fk.constraint}: parent must be created first`);
      const parent = tables.get(fk.parent);
      assert.equal(fk.columns.length, fk.parentColumns.length, fk.constraint);
      assert.ok(parent.keys.some((key) => key.unique
        && key.columns.length === fk.parentColumns.length && hasPrefix(key, fk.parentColumns)), fk.constraint);
      assert.ok(table.keys.some((key) => hasPrefix(key, fk.columns)), `${fk.constraint}: child index`);
      fk.columns.forEach((column, index) => {
        assert.ok(table.columns.has(column), `${tableName}.${column}`);
        assert.ok(parent.columns.has(fk.parentColumns[index]), fk.constraint);
        assert.equal(typeOf(table.columns.get(column)),
          typeOf(parent.columns.get(fk.parentColumns[index])), fk.constraint);
      });
      if (table.columns.has('game_id') && parent.columns.has('game_id')) {
        assert.equal(fk.columns[0], 'game_id', `${fk.constraint}: missing game scope`);
        assert.equal(fk.parentColumns[0], 'game_id', fk.constraint);
      }
    }
    created.add(tableName);
  }
});

test('critical uniqueness and check declarations remain present (not behavioral SQL tests)', () => {
  for (const declaration of [
    'UNIQUE KEY uq_game_host (host_game_id)',
    'UNIQUE KEY uq_player_nickname (game_id, nickname_key)',
    'UNIQUE KEY uq_assignment_claim (game_id, game_mission_id)',
    'UNIQUE KEY uq_assignment_open_slot (game_id, player_id, open_slot_number)',
    'UNIQUE KEY uq_offer_current (game_id, current_player_id)',
    'PRIMARY KEY (game_id, actor_player_id, target_player_id, cycle_number)',
    'KEY ix_hit_cycle (game_id, actor_player_id, cycle_number, target_player_id)',
    'PRIMARY KEY (game_id, player_id, request_id)',
    'CHECK (slot_number BETWEEN 1 AND 10)',
    'CHECK (position BETWEEN 1 AND 3)',
    'target_player_id <> player_id',
    'target_cycle IS NOT NULL AND target_cycle >= 1',
    'utf8mb4_0900_as_ci',
  ]) assert.ok(sql.includes(declaration), declaration);
  assert.doesNotMatch(sql, /ck_game_rules|slot_count = 5|resolution_count/);
  assert.doesNotMatch(tables.get('games').body, /slot_count|cooldown_/);
  const settings = tables.get('game_settings');
  for (const [column, fragment] of [
    ['slot_count', 'DEFAULT 5'], ['offer_size', 'DEFAULT 2'], ['rerolls_per_player', 'DEFAULT 0'],
    ['cooldown_base_minutes', 'DEFAULT 5'], ['cooldown_scaling', "DEFAULT 'multiply'"],
    ['cooldown_multiplier', 'DEFAULT 2.00'], ['cooldown_cap_minutes', 'DEFAULT 360'],
    ['cooldown_counts_failures', 'DEFAULT TRUE'], ['target_rule', "DEFAULT 'cycle_all'"],
    ['failure_points', 'DEFAULT 0'], ['allow_negative_score', 'DEFAULT FALSE'],
    ['win_ends_game', 'DEFAULT TRUE'], ['leaderboard_mode', "DEFAULT 'anonymous'"],
    ['chat_enabled', 'DEFAULT TRUE'], ['result_posts', "DEFAULT 'full'"],
    ['result_names_when_board_off', "DEFAULT 'alias'"], ['allow_late_join', 'DEFAULT TRUE'],
  ]) assert.ok(settings.columns.get(column)?.includes(fragment), `game_settings.${column} ${fragment}`);
  for (const column of ['time_limit_minutes', 'win_score_target', 'max_players', 'target_distinct_count']) {
    assert.match(settings.columns.get(column), /\bNULL\b/, column);
    assert.doesNotMatch(settings.columns.get(column), /NOT NULL|DEFAULT/, column);
  }
  for (const check of ['ck_settings_wallet', 'ck_settings_cooldown', 'ck_settings_targets',
    'ck_settings_scoring', 'ck_settings_ending', 'ck_settings_joining']) assert.match(settings.body, new RegExp(check));
  assert.match(settings.body, /PRIMARY KEY \(game_id\)/);
  for (const table of ['missions', 'game_missions']) assert.match(tables.get(table).body, /allows_group BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(tables.get('game_messages').body, /'settings_changed'/);
  assert.match(tables.get('game_messages').body, /AND message_text IS NULL\)/);
  assert.doesNotMatch(tables.get('mutation_receipts').body, /FOREIGN KEY \(result_resource_id\)/);
  assert.doesNotMatch(tables.get('game_missions').body, /source_pack_id|source_mission_id|state ENUM/);
  assert.doesNotMatch(tables.get('mission_packs').body, /player_id|device_id|game_id/);
});

test('Mermaid contains all SQL tables and only real columns and relationships', () => {
  assert.match(mermaid, /deterministicIds: true/);
  assert.match(mermaid, /handDrawnSeed: 42/);
  const entities = new Map([...mermaid.matchAll(/^    (\w+) \{\n([\s\S]*?)^    \}/gm)]
    .map(([, name, body]) => [name, body]));
  assert.deepEqual([...entities.keys()], expectedTables);
  for (const [name, body] of entities) {
    for (const [, column] of body.matchAll(/^        \w+ (\w+)/gm)) {
      assert.ok(tables.get(name).columns.has(column), `${name}.${column}`);
    }
  }
  for (const [, left, right] of mermaid.matchAll(/^    (\w+) [|o{}-]+ (\w+) :/gm)) {
    assert.ok(entities.has(left) && entities.has(right), `${left} -> ${right}`);
    assert.ok(tables.get(left).foreignKeys.some((fk) => fk.parent === right)
      || tables.get(right).foreignKeys.some((fk) => fk.parent === left), `${left} -> ${right}`);
  }
});

test('example catalog seed has eight independent missions, group flags and no player credentials', () => {
  const seed = read('database/seeds/001_example_catalog.sql');
  const rows = [...seed.matchAll(/^\s+\(UNHEX\('([0-9a-f]{32})'\), UNHEX\('([0-9a-f]{32})'\), (\d+), '([^']+)', (TRUE|FALSE)\)[,;]/gm)];
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map((row) => row[1])).size, rows.length);
  assert.deepEqual(rows.map((row) => Number(row[3])), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const row of rows) assert.equal(row[2], '00000000000040008000000000000001');
  assert.ok(rows.some((row) => row[5] === 'TRUE') && rows.some((row) => row[5] === 'FALSE'));
  assert.match(seed, /START TRANSACTION;/);
  assert.match(seed, /COMMIT;/);
  assert.doesNotMatch(seed, /INSERT INTO (?:game_players|games|game_settings)|password|secret_hash/);
});

function filesIn(relative) {
  return readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? filesIn(name) : [name];
  });
}

test('all local Markdown links resolve, including skill resources', () => {
  const files = ['README.md', 'AGENTS.md', ...filesIn('docs'), ...filesIn('.github')];
  for (const file of files.filter((name) => name.endsWith('.md'))) {
    for (const [, target] of read(file).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:\/\//i.test(target) || target.startsWith('#')) continue;
      const destination = decodeURIComponent(target.split('#')[0]);
      assert.ok(existsSync(path.resolve(root, path.dirname(file), destination)), `${file} -> ${target}`);
    }
  }
});

test('agent guidance uses one root convention and a discoverable workflow skill', () => {
  assert.ok(existsSync(path.join(root, 'AGENTS.md')));
  assert.ok(!existsSync(path.join(root, '.github/copilot-instructions.md')));
  const skill = read('.github/skills/database-change/SKILL.md');
  assert.match(skill, /^---\r?\nname: database-change\r?\ndescription: '[^'\r\n]+'\r?\n---/);
  assert.match(skill, /MySQL/);
});

test('legacy runtime and hosting files are absent', () => {
  for (const file of [
    '.firebaserc', 'firebase.json', '.opencode/SKILL.md', '.opencode/conventions.md',
    'client/package.json', 'client/package-lock.json', 'client/src/App.tsx',
    'server/package.json', 'server/package-lock.json', 'server/server.js',
    'server/firestore-db.js', 'server/Dockerfile',
    'server/data/users.example.json', 'schemas/users.schema.json', 'schemas/missions.schema.json',
  ]) assert.ok(!existsSync(path.join(root, file)), file);
  for (const file of [...filesIn('database'), ...filesIn('.github')]) {
    assert.doesNotMatch(read(file), /@google-cloud\/firestore|firebase-admin|require\(['"]firebase/);
  }
});

test('generated SVG is a real diagram containing all entity labels', () => {
  const svg = read('docs/database.svg');
  assert.match(svg, /<svg\b/);
  assert.match(svg, /viewBox="[^"]+"/);
  assert.match(svg, /<\/svg>/);
  assert.ok(svg.length > 10000, 'expected rendered diagram, not placeholder');
  for (const table of expectedTables) assert.ok(svg.includes(table), table);
});

test('wireframes are generated, phone-sized, grayscale and documented', async () => {
  const { renderAll, screens, OUTPUT_DIR } = await import('./wireframes.mjs');
  const rendered = renderAll();
  assert.equal(screens.length, 18);
  const onDisk = readdirSync(path.join(root, OUTPUT_DIR)).filter((name) => name.endsWith('.svg')).sort();
  assert.deepEqual(onDisk, [...rendered.keys()].sort(), 'no stale or missing wireframe SVGs');
  const readme = read(`${OUTPUT_DIR}/README.md`);
  for (const [file, svg] of rendered) {
    assert.equal(read(`${OUTPUT_DIR}/${file}`), svg, `${file} is out of date; run node tools\\wireframes.mjs`);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 390 844"/, file);
    assert.match(svg, /<\/svg>\s*$/, file);
    for (const [, hex] of svg.matchAll(/#([0-9a-f]{6})\b/gi)) {
      const [r, g, b] = [0, 2, 4].map((index) => hex.slice(index, index + 2).toLowerCase());
      assert.ok(r === g && g === b, `${file} uses non-grayscale #${hex}`);
    }
    assert.match(readme, new RegExp(`\\]\\(${file.replace('.', '\\.')}\\)`), `README links ${file}`);
  }
});
