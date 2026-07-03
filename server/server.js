import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { scanProject } from './scanner.js';
import { buildHeuristicReport } from './heuristic.js';
import { readTextFileSafe } from './fs-utils.js';
import { analyzeWithAI, askWithAI } from './ai.js';
import { readConfig, writeConfig, redactConfig } from './config-store.js';
import { buildContextPack } from './context-pack.js';
import { normalizeReport, summarizeContextPack } from './report-normalizer.js';
import { enrichContext } from './context-enrichment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const webRoot = path.join(packageRoot, 'web');

let cache = {
  scan: null,
  report: null,
  contextPack: null
};

export async function startServer({ projectDir, port, host }) {
  const stat = await fs.stat(projectDir);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${projectDir}`);

  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/config', async (_req, res, next) => {
    try { res.json(redactConfig(await readConfig())); } catch (error) { next(error); }
  });

  app.post('/api/config', async (req, res, next) => {
    try {
      const body = req.body || {};
      const current = await readConfig();
      const nextConfig = {
        provider: body.provider || current.provider,
        baseURL: body.baseURL || current.baseURL,
        model: body.model || current.model,
        apiKey: body.apiKey && body.apiKey !== '********' ? body.apiKey : current.apiKey
      };
      const saved = await writeConfig(nextConfig);
      res.json(redactConfig(saved));
    } catch (error) { next(error); }
  });

  app.get('/api/project', async (_req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      if (!cache.report) cache.report = buildHeuristicReport(cache.scan);
      res.json({ projectDir, scan: cache.scan, report: cache.report });
    } catch (error) { next(error); }
  });

  app.post('/api/rescan', async (_req, res, next) => {
    try {
      cache.scan = await scanProject(projectDir);
      cache.report = buildHeuristicReport(cache.scan);
      cache.contextPack = null;
      res.json({ projectDir, scan: cache.scan, report: cache.report });
    } catch (error) { next(error); }
  });

  app.post('/api/analyze', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      const config = { ...(await readConfig()), ...(req.body?.config || {}) };
      cache.contextPack = await buildContextPack({ root: projectDir, scan: cache.scan });
      const report = await analyzeWithAI({ scan: cache.scan, chunks: cache.contextPack.chunks, contextPack: cache.contextPack, config });
      cache.report = normalizeReport(report, cache.contextPack);
      res.json({ report: cache.report, contextPack: summarizeContextPack(cache.contextPack) });
    } catch (error) { next(error); }
  });

  app.get('/api/repo-map', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      if (req.query.download === '1') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="repo-map.json"');
        return res.send(JSON.stringify(cache.scan.repoMap || {}, null, 2));
      }
      res.json(cache.scan.repoMap || {});
    } catch (error) { next(error); }
  });

  app.get('/api/context-pack', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      if (!cache.contextPack) cache.contextPack = await buildContextPack({ root: projectDir, scan: cache.scan });
      if (req.query.format === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="project-context.md"');
        return res.send(cache.contextPack.markdown);
      }
      res.json(summarizeContextPack(cache.contextPack));
    } catch (error) { next(error); }
  });

  app.get('/api/file', async (req, res, next) => {
    try {
      const relPath = String(req.query.path || '');
      const file = await readTextFileSafe(projectDir, relPath);
      res.json(file);
    } catch (error) { next(error); }
  });

  app.get('/api/search', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q) return res.json({ results: [] });
      const results = cache.scan.files
        .filter((f) => f.text && f.path.toLowerCase().includes(q))
        .slice(0, 80)
        .map((f) => ({ path: f.path, role: f.role, priority: f.priority, language: f.language }));
      res.json({ results });
    } catch (error) { next(error); }
  });

  app.post('/api/ask', async (req, res, next) => {
    try {
      const { question, context = {}, config: bodyConfig = {} } = req.body || {};
      if (!question || !String(question).trim()) throw new Error('question is required');
      const config = { ...(await readConfig()), ...bodyConfig };
      const enrichedContext = await enrichContext(projectDir, context);
      const answer = await askWithAI({ question: String(question), context: enrichedContext, config });
      res.json({ answer });
    } catch (error) { next(error); }
  });

  const vite = await createViteServer({
    root: webRoot,
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);

  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err?.message || String(err) });
  });

  return await new Promise((resolve) => {
    const listener = app.listen(port, host, () => {
      resolve({ app, listener, port: listener.address().port });
    });
  });
}
