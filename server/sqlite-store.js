import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const DB_DIR = path.join(os.homedir(), '.project-fast-onboarding');
const DEFAULT_DB_PATH = path.join(DB_DIR, 'codeatlas.db');

export async function recordScanRun(projectDir, scan) {
  return writeRecord((db) => {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO scan_runs (id, project_key, project_dir, created_at, total_files, total_symbols, payload) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id('scan'), projectKey(projectDir), projectDir, now, scan?.totalFiles || scan?.files?.length || 0, scan?.totalSymbols || 0, json(scan)
    );
  });
}

export async function recordReport(projectDir, report) {
  return writeRecord((db) => {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO reports (id, project_key, project_dir, saved_at, payload) VALUES (?, ?, ?, ?, ?)`).run(
      id('report'), projectKey(projectDir), projectDir, now, json(report)
    );
  });
}

export async function recordAskThread(projectDir, { question, context, answer }) {
  return writeRecord((db) => {
    const scope = scopeFromAskContext(context);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO ask_threads (id, project_key, project_dir, scope_key, scope_type, created_at, question, answer, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id('ask'), projectKey(projectDir), projectDir, scope.key, scope.type, now, String(question || ''), json(answer), json({ question, context, answer })
    );
  });
}

export async function recordVerification(projectDir, patch) {
  return writeRecord((db) => {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO verification_events (id, project_key, project_dir, kind, target_id, status, verified_at, verified_by, note, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id('verify'), projectKey(projectDir), projectDir, patch?.kind || '', patch?.id || '', patch?.verificationStatus || '', now, patch?.verifiedBy || 'local-user', patch?.verificationNote || patch?.note || '', json(patch)
    );
  });
}

export async function recordCodeGraph(projectDir, graph) {
  return writeRecord((db) => {
    db.prepare(`INSERT INTO code_graphs (id, project_key, project_dir, generated_at, nodes, edges, warnings, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id('graph'), projectKey(projectDir), projectDir, graph?.generatedAt || new Date().toISOString(), graph?.nodes?.length || 0, graph?.edges?.length || 0, graph?.warnings?.length || 0, json(graph)
    );
  });
}

export async function recordExplainCache(projectDir, { scopeKey, payload }) {
  return writeRecord((db) => {
    const now = new Date().toISOString();
    db.prepare(`INSERT OR REPLACE INTO explain_cache (id, project_key, project_dir, scope_key, created_at, payload) VALUES (?, ?, ?, ?, ?, ?)`).run(
      `${projectKey(projectDir)}:${scopeKey}`, projectKey(projectDir), projectDir, scopeKey, now, json(payload)
    );
  });
}

export async function getProjectDatabaseSnapshot(projectDir) {
  return readRecord((db) => {
    const key = projectKey(projectDir);
    return {
      scanRuns: count(db, 'scan_runs', key),
      reports: count(db, 'reports', key),
      askThreads: count(db, 'ask_threads', key),
      verificationEvents: count(db, 'verification_events', key),
      codeGraphs: count(db, 'code_graphs', key),
      explainCache: count(db, 'explain_cache', key)
    };
  }, { scanRuns: 0, reports: 0, askThreads: 0, verificationEvents: 0, codeGraphs: 0, explainCache: 0 });
}

async function writeRecord(action) {
  const db = await openDatabaseIfAvailable();
  if (!db) return { ok: false, skipped: true };
  try {
    action(db);
    return { ok: true, skipped: false };
  } finally {
    db.close();
  }
}

async function readRecord(action, fallback) {
  const db = await openDatabaseIfAvailable();
  if (!db) return fallback;
  try {
    return action(db);
  } finally {
    db.close();
  }
}

async function openDatabaseIfAvailable() {
  if (process.env.PFO_DISABLE_SQLITE === '1') return null;
  let sqlite;
  try {
    sqlite = await import('node:sqlite');
  } catch {
    return null;
  }
  await fs.mkdir(path.dirname(databasePath()), { recursive: true });
  const db = new sqlite.DatabaseSync(databasePath());
  initialize(db);
  return db;
}

function initialize(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_runs (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      project_dir TEXT NOT NULL,
      created_at TEXT NOT NULL,
      total_files INTEGER NOT NULL,
      total_symbols INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      project_dir TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ask_threads (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      project_dir TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification_events (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      project_dir TEXT NOT NULL,
      kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      status TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      verified_by TEXT NOT NULL,
      note TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS code_graphs (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      project_dir TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      nodes INTEGER NOT NULL,
      edges INTEGER NOT NULL,
      warnings INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS explain_cache (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      project_dir TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);
}

function count(db, table, key) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE project_key = ?`).get(key).count;
}

function databasePath() {
  return process.env.PFO_SQLITE_PATH || DEFAULT_DB_PATH;
}

function projectKey(projectDir) {
  return crypto.createHash('sha256').update(path.resolve(projectDir)).digest('hex');
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function scopeFromAskContext(context = {}) {
  if (context.activeRisk?.id || context.activeRisk?.title) return { type: 'risk', key: context.activeRisk.id || context.activeRisk.title };
  if (context.activeFlow?.id || context.activeFlow?.name) return { type: 'flow', key: context.activeFlow.id || context.activeFlow.name };
  if (context.currentSymbol?.id) return { type: 'symbol', key: context.currentSymbol.id };
  if (context.currentFile?.path && context.selection) return { type: 'selection', key: `${context.currentFile.path}:${context.selection.startLine}-${context.selection.endLine}` };
  if (context.currentFile?.path) return { type: 'file', key: context.currentFile.path };
  return { type: 'project', key: 'project' };
}
