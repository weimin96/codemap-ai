import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { scanProject } from './scanner.js';
import { readTextFileSafe } from './fs-utils.js';
import { analyzeWithAI, askWithAI } from './ai.js';
import { readConfig, writeConfig, redactConfig } from './config-store.js';
import { buildContextPack } from './context-pack.js';
import { normalizeReport, summarizeContextPack } from './report-normalizer.js';
import { enrichContext } from './context-enrichment.js';
import { deleteProjectReport, readProjectReport, writeProjectReport } from './report-store.js';
import { buildCodeGraph, findShortestPath } from './code-graph.js';
import { buildDocumentSet } from './document-exporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const webRoot = path.join(packageRoot, 'web');

let cache = {
  scan: null,
  report: null,
  contextPack: null,
  codeGraph: null
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
        apiKey: body.apiKey === '********' ? current.apiKey : typeof body.apiKey === 'string' ? body.apiKey : current.apiKey
      };
      const saved = await writeConfig(nextConfig);
      res.json(redactConfig(saved));
    } catch (error) { next(error); }
  });

  app.post('/api/config/test', async (req, res, next) => {
    try {
      const current = await readConfig();
      const bodyConfig = req.body?.config || {};
      const config = {
        ...current,
        ...bodyConfig,
        apiKey: bodyConfig.apiKey === '********' ? current.apiKey : typeof bodyConfig.apiKey === 'string' ? bodyConfig.apiKey : current.apiKey
      };
      const result = await testAiConnection(config);
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/api/project', async (_req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      if (!cache.report) {
        const storedReport = await readProjectReport(projectDir);
        cache.report = storedReport ? normalizeReport(storedReport, null, cache.scan) : null;
      }
      res.json({ projectDir, scan: cache.scan, report: cache.report });
    } catch (error) { next(error); }
  });

  app.post('/api/rescan', async (_req, res, next) => {
    try {
      cache.scan = await scanProject(projectDir);
      const storedReport = await readProjectReport(projectDir);
      cache.report = storedReport ? normalizeReport(storedReport, null, cache.scan) : null;
      cache.contextPack = null;
      cache.codeGraph = null;
      res.json({ projectDir, scan: cache.scan, report: cache.report });
    } catch (error) { next(error); }
  });

  app.post('/api/analyze', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      const config = await mergeRuntimeConfig(req.body?.config || {});
      cache.report = null;
      await deleteProjectReport(projectDir);
      cache.contextPack = await buildContextPack({ root: projectDir, scan: cache.scan });
      const report = await analyzeWithAI({ scan: cache.scan, chunks: cache.contextPack.chunks, contextPack: cache.contextPack, config });
      cache.report = normalizeReport(report, cache.contextPack, cache.scan);
      await writeProjectReport(projectDir, cache.report);
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

  app.get('/api/code-graph', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      if (!cache.codeGraph) cache.codeGraph = await buildCodeGraph({ root: projectDir, scan: cache.scan });
      const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : '';
      const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : '';
      const connection = sourceId && targetId ? findShortestPath(cache.codeGraph, sourceId, targetId) : [];
      res.json({ graph: cache.codeGraph, connection });
    } catch (error) { next(error); }
  });

  app.get('/api/onboarding-docs', async (_req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      if (!cache.report) {
        const storedReport = await readProjectReport(projectDir);
        cache.report = storedReport ? normalizeReport(storedReport, null, cache.scan) : null;
      }
      res.json(buildDocumentSet({ report: cache.report, scan: cache.scan }));
    } catch (error) { next(error); }
  });

  app.get('/api/context-pack', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      const mode = String(req.query.mode || 'overview');
      const target = buildContextTarget(req.query);
      if (!cache.contextPack || mode !== 'overview' || Object.keys(target).length) {
        cache.contextPack = await buildContextPack({ root: projectDir, scan: cache.scan, mode, target });
      }
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
      const config = await mergeRuntimeConfig(bodyConfig);
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

async function mergeRuntimeConfig(bodyConfig) {
  const current = await readConfig();
  return {
    ...current,
    ...bodyConfig,
    apiKey: bodyConfig.apiKey === '********' ? current.apiKey : typeof bodyConfig.apiKey === 'string' ? bodyConfig.apiKey : current.apiKey
  };
}

async function testAiConnection(config) {
  const provider = config.provider || 'openai-compatible';
  const baseURL = config.baseURL || defaultBaseURL(provider);
  const candidates = provider === 'ollama' ? [joinProviderURL(baseURL, 'tags')] : buildModelsURLCandidates(baseURL, providerModelsURL(provider));
  const headers = provider === 'ollama' ? {} : authHeaders(config.apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let lastError = '';
    for (const target of candidates) {
      const response = await fetch(target, { headers, signal: controller.signal });
      if (!response.ok) {
        const text = await response.text();
        const message = `${response.status} ${response.statusText}${text ? `: ${truncateBody(text)}` : ''}`;
        if (response.status === 404 || response.status === 405) {
          lastError = message;
          continue;
        }
        throw new Error(message);
      }
      const data = await response.json().catch((error) => {
        throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`);
      });
      const models = extractModelIds(data);
      return { ok: true, provider, endpoint: target, modelCount: models.length, models };
    }
    throw new Error(`All candidates failed: ${lastError || 'no candidates'}`);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`连接超时：${baseURL}`);
    throw new Error(`连接失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

const COMPAT_SUFFIXES = ['/api/claudecode', '/api/anthropic', '/apps/anthropic', '/api/coding', '/claudecode', '/anthropic', '/step_plan', '/coding', '/claude'];

function buildModelsURLCandidates(baseURL, modelsURL) {
  if (modelsURL) return [modelsURL];
  const trimmed = String(baseURL || '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Base URL 不能为空');
  const candidates = [];
  if (endsWithVersionSegment(trimmed)) {
    candidates.push(`${trimmed}/models`);
    if (!trimmed.endsWith('/v1')) candidates.push(`${trimmed}/v1/models`);
  } else {
    candidates.push(`${trimmed}/v1/models`);
  }
  const stripped = stripCompatSuffix(trimmed);
  if (stripped) {
    candidates.push(`${stripped}/v1/models`);
    candidates.push(`${stripped}/models`);
  }
  return candidates.filter((url, index) => candidates.indexOf(url) === index);
}

function providerModelsURL(provider) {
  if (provider === 'deepseek') return 'https://api.deepseek.com/models';
  return '';
}

function endsWithVersionSegment(value) {
  const last = value.split('/').pop() || '';
  return /^v\d+$/.test(last);
}

function stripCompatSuffix(value) {
  const suffix = COMPAT_SUFFIXES.find((item) => value.endsWith(item));
  if (!suffix) return '';
  return value.slice(0, -suffix.length).replace(/\/+$/, '');
}

function truncateBody(value) {
  return value.length > 512 ? `${value.slice(0, 512)}…` : value;
}

function buildContextTarget(query) {
  const target = {};
  for (const key of ['moduleId', 'moduleName', 'flowId', 'riskId', 'path', 'symbol']) {
    const value = query[key];
    if (typeof value === 'string' && value.trim()) target[key] = value.trim();
  }
  return target;
}

function extractModelIds(data) {
  if (Array.isArray(data?.data)) {
    return data.data.map((item) => item?.id).filter(Boolean).sort();
  }
  if (Array.isArray(data?.models)) {
    return data.models.map((item) => item?.name || item?.model || item?.id).filter(Boolean).sort();
  }
  return [];
}

function joinProviderURL(baseURL, pathName) {
  const normalized = String(baseURL || '').trim();
  if (!normalized) throw new Error('Base URL 不能为空');
  const base = normalized.endsWith('/') ? normalized : `${normalized}/`;
  return new URL(pathName, base).toString();
}

function authHeaders(apiKey) {
  if (!apiKey) throw new Error('API Key 不能为空');
  return { Authorization: `Bearer ${apiKey}` };
}

function defaultBaseURL(provider) {
  if (provider === 'ollama') return 'http://127.0.0.1:11434/api';
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  if (provider === 'kimi') return 'https://api.moonshot.cn/v1';
  if (provider === 'zhipu') return 'https://open.bigmodel.cn/api/paas/v4';
  if (provider === 'siliconflow') return 'https://api.siliconflow.cn/v1';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  return 'https://api.openai.com/v1';
}
