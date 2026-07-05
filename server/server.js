import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

import { fileURLToPath } from 'node:url';
import { scanProject } from './scanner.js';
import { readTextFileSafe } from './fs-utils.js';
import { askWithAI, resolveAiTimeoutMs } from './ai.js';
import { runAnalysisJob } from './analysis-job.js';
import { readConfig, writeConfig, redactConfig } from './config-store.js';
import { buildContextPack } from './context-pack.js';
import { normalizeReport, summarizeContextPack } from './report-normalizer.js';
import { enrichContext } from './context-enrichment.js';
import { redactAiInput } from './redaction.js';
import { readProjectReport, writeProjectReport } from './report-store.js';
import { buildCodeGraph, findShortestPath } from './code-graph.js';
import { buildDocumentSet } from './document-exporter.js';
import { updateVerification } from './verification.js';
import { readExplainCache, recordAskThread, recordCodeGraph, recordExplainCache, recordReport, recordScanRun, recordVerification } from './sqlite-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const webRoot = path.join(packageRoot, 'web');
const webDistRoot = path.join(webRoot, 'dist');

function createServerCache() {
  return {
  scan: null,
  report: null,
  contextPack: null,
  codeGraph: null
  };
}

export async function startServer({ projectDir, port, host, serveWeb = true, accessToken = '' }) {
  const cache = createServerCache();
  const stat = await fs.stat(projectDir);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${projectDir}`);

  const app = express();
  app.use(express.json({ limit: '20mb' }));
  installAccessTokenGuard(app, accessToken);

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
        apiKey: body.apiKey === '********' ? current.apiKey : typeof body.apiKey === 'string' ? body.apiKey : current.apiKey,
        timeoutMs: body.timeoutMs === undefined || body.timeoutMs === null ? current.timeoutMs : body.timeoutMs,
        fallbackPolicy: typeof body.fallbackPolicy === 'string' ? body.fallbackPolicy : current.fallbackPolicy || 'local-only'
      };
      nextConfig.timeoutMs = resolveAiTimeoutMs(nextConfig);
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
      if (!cache.scan) {
        cache.scan = await scanProject(projectDir);
        await recordScanRun(projectDir, cache.scan);
      }
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
      await recordScanRun(projectDir, cache.scan);
      const storedReport = await readProjectReport(projectDir);
      cache.report = storedReport ? normalizeReport(storedReport, null, cache.scan) : null;
      cache.contextPack = null;
      cache.codeGraph = null;
      res.json({ projectDir, scan: cache.scan, report: cache.report });
    } catch (error) { next(error); }
  });

  app.post('/api/analyze', async (req, res, next) => {
    try {
      const config = await mergeRuntimeConfig(req.body?.config || {});
      const result = await runAnalysisJob({ projectDir, cache, config });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/api/analyze/stream', async (req, res) => {
    const controller = new AbortController();
    let completed = false;
    res.on('close', () => {
      if (!completed && !res.writableEnded) controller.abort();
    });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });
    const emit = (event, data) => {
      if (res.destroyed) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const config = await mergeRuntimeConfig(req.body?.config || {});
      const result = await runAnalysisJob({
        projectDir,
        cache,
        config,
        signal: controller.signal,
        onProgress: (data) => emit('progress', data),
        onPartial: (data) => emit('partial', data)
      });
      emit('done', result);
      completed = true;
    } catch (error) {
      if (!controller.signal.aborted) emit('error', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      res.end();
    }
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
      if (!cache.codeGraph) {
        cache.codeGraph = await buildCodeGraph({ root: projectDir, scan: cache.scan });
        await recordCodeGraph(projectDir, cache.codeGraph);
      }
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
      if (!cache.codeGraph) {
        cache.codeGraph = await buildCodeGraph({ root: projectDir, scan: cache.scan });
        await recordCodeGraph(projectDir, cache.codeGraph);
      }
      res.json(buildDocumentSet({ report: cache.report, scan: cache.scan, codeGraph: cache.codeGraph }));
    } catch (error) { next(error); }
  });

  app.post('/api/verification', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      if (!cache.report) {
        const storedReport = await readProjectReport(projectDir);
        cache.report = storedReport ? normalizeReport(storedReport, null, cache.scan) : null;
      }
      cache.report = updateVerification(cache.report, req.body || {});
      await writeProjectReport(projectDir, cache.report);
      await recordVerification(projectDir, req.body || {});
      await recordReport(projectDir, cache.report);
      res.json({ report: cache.report });
    } catch (error) { next(error); }
  });

  app.get('/api/context-pack', async (req, res, next) => {
    try {
      if (!cache.scan) cache.scan = await scanProject(projectDir);
      const mode = String(req.query.mode || 'overview');
      const target = buildContextTarget(req.query);
      if (!cache.contextPack || mode !== 'overview' || Object.keys(target).length) {
        if (!cache.codeGraph && (mode !== 'overview' || Object.keys(target).length)) {
          cache.codeGraph = await buildCodeGraph({ root: projectDir, scan: cache.scan });
          await recordCodeGraph(projectDir, cache.codeGraph);
        }
        cache.contextPack = await buildContextPack({ root: projectDir, scan: cache.scan, mode, target, codeGraph: cache.codeGraph });
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

  app.post('/api/explain-node', async (req, res, next) => {
    try {
      const { scopeKey, mode = 'selected', node, relatedEdges = [], warnings = [], businessLinks = {}, config: bodyConfig = {} } = req.body || {};
      if (!scopeKey) throw new Error('scopeKey is required');
      if (!node?.id) throw new Error('node is required');
      const cached = await readExplainCache(projectDir, scopeKey);
      if (cached?.explanation) return res.json({ cached: true, explanation: cached.explanation, answer: cached.answer || null });
      const config = await mergeRuntimeConfig(bodyConfig);
      const question = buildExplainQuestion(node, mode);
      const context = { mode, node, relatedEdges, warnings, businessLinks };
      const safeInput = redactAiInput({ question, context });
      const answer = await askWithAI({ question: safeInput.question, context: safeInput.context, config });
      const explanation = formatExplainAnswer(answer);
      const payload = { explanation, answer, node, relatedEdges, warnings, businessLinks, generatedAt: new Date().toISOString() };
      await recordExplainCache(projectDir, { scopeKey, payload });
      res.json({ cached: false, explanation, answer });
    } catch (error) { next(error); }
  });

  app.post('/api/ask', async (req, res, next) => {
    try {
      const { question, context = {}, config: bodyConfig = {} } = req.body || {};
      if (!question || !String(question).trim()) throw new Error('question is required');
      const config = await mergeRuntimeConfig(bodyConfig);
      if (!cache.scan) {
        cache.scan = await scanProject(projectDir);
        await recordScanRun(projectDir, cache.scan);
      }
      if (!cache.codeGraph) {
        cache.codeGraph = await buildCodeGraph({ root: projectDir, scan: cache.scan });
        await recordCodeGraph(projectDir, cache.codeGraph);
      }
      const enrichedContext = await enrichContext(projectDir, context, cache.codeGraph);
      const safeInput = redactAiInput({ question: String(question), context: enrichedContext });
      const answer = await askWithAI({ question: safeInput.question, context: safeInput.context, config });
      await recordAskThread(projectDir, { question: safeInput.question, context: safeInput.context, answer });
      res.json({ answer });
    } catch (error) { next(error); }
  });

  const webApp = serveWeb ? await mountWebApp(app, port) : null;

  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err?.message || String(err) });
  });

  return await new Promise((resolve) => {
    const listener = app.listen(port, host, () => {
      listener.on('close', () => {
        void webApp?.close?.();
      });
      resolve({ app, listener, port: listener.address().port });
    });
  });
}

function installAccessTokenGuard(app, accessToken) {
  if (!accessToken) return;
  app.use((req, res, next) => {
    if (requestHasAccessToken(req, accessToken)) {
      res.cookie('codemap_ai_token', accessToken, { httpOnly: true, sameSite: 'strict', path: '/' });
      return next();
    }
    if (!req.path.startsWith('/api/') || req.path === '/api/health') return next();
    return res.status(401).json({ error: 'Access token is required.' });
  });
}

function requestHasAccessToken(req, accessToken) {
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const headerToken = String(req.get('x-codemap-ai-token') || '').trim();
  const authHeader = String(req.get('authorization') || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = readCookie(req, 'codemap_ai_token');
  return [queryToken, headerToken, bearerToken, cookieToken].includes(accessToken);
}

function readCookie(req, name) {
  const header = req.get('cookie');
  if (!header) return '';
  for (const item of header.split(';')) {
    const [rawKey, ...rest] = item.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

async function mountWebApp(app, port) {
  const distIndex = path.join(webDistRoot, 'index.html');
  if (process.env.CODEMAP_AI_DEV_SERVER !== '1' && await pathExists(distIndex)) {
    app.use(express.static(webDistRoot));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      return res.sendFile(distIndex);
    });
    return null;
  }

  const { createServer } = await import('vite');
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true, hmr: { port: port + 1 } },
    appType: 'spa'
  });
  app.use(vite.middlewares);
  return vite;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function buildExplainQuestion(node, mode = 'selected') {
  const modeLabel = {
    selected: 'Explain selected：解释当前选中对象',
    neighbors: 'Explain neighbors：解释直接邻居和 2-hop 影响范围',
    'flow-impact': 'Explain current flow impact：解释当前链路影响',
    'risk-path': 'Explain risk path：解释风险影响路径'
  }[mode] || 'Explain selected：解释当前选中对象';
  return `请基于代码图谱执行 ${modeLabel}。说明节点职责、直接关系、影响范围、相关模块/链路/风险，以及下一步人工验证动作。节点：${node.name} (${node.type}) ${node.path || ''}`;
}

function formatExplainAnswer(answer) {
  return [
    answer.conclusion ? `结论：${answer.conclusion}` : '',
    answer.markdown || '',
    answer.nextSteps?.length ? `下一步：${answer.nextSteps.join('；')}` : '',
    answer.risks?.length ? `风险：${answer.risks.join('；')}` : ''
  ].filter(Boolean).join('\n\n');
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
  if (provider === 'auto') {
    return { ok: false, provider, checks: [{ name: 'provider', ok: false, error: 'auto provider requires explicit profile before connection test' }], modelCount: 0, models: [] };
  }
  const baseURL = config.baseURL || defaultBaseURL(provider);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const modelsCheck = await testModelsEndpoint({ provider, baseURL, config, signal: controller.signal });
    const completionCheck = await testChatCompletion({ provider, baseURL, config, signal: controller.signal });
    const structuredCheck = await testStructuredOutput({ provider, baseURL, config, signal: controller.signal });
    const checks = [modelsCheck, completionCheck, structuredCheck];
    return {
      ok: checks.every((check) => check.ok || check.optional),
      provider,
      endpoint: completionCheck.endpoint || modelsCheck.endpoint || baseURL,
      modelCount: modelsCheck.models?.length || 0,
      models: modelsCheck.models || [],
      checks
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`连接超时：${baseURL}`);
    throw new Error(`连接失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function testModelsEndpoint({ provider, baseURL, config, signal }) {
  const candidates = provider === 'ollama' ? [joinProviderURL(baseURL, 'tags')] : buildModelsURLCandidates(baseURL, providerModelsURL(provider));
  const headers = provider === 'ollama' ? {} : authHeaders(config.apiKey);
  let lastError = '';
  for (const target of candidates) {
    const response = await fetch(target, { headers, signal });
    if (!response.ok) {
      lastError = await responseError(response);
      if (response.status === 404 || response.status === 405) continue;
      return { name: 'models', ok: false, endpoint: target, error: lastError };
    }
    const data = await response.json();
    const models = extractModelIds(data);
    return { name: 'models', ok: true, endpoint: target, models };
  }
  return { name: 'models', ok: false, optional: true, endpoint: candidates[0] || baseURL, error: lastError || 'models endpoint is not available' };
}

async function testChatCompletion({ provider, baseURL, config, signal }) {
  const target = provider === 'ollama' ? joinProviderURL(baseURL, 'chat') : joinProviderURL(baseURL, 'chat/completions');
  const response = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(provider === 'ollama' ? {} : authHeaders(config.apiKey)) },
    body: JSON.stringify(buildCompletionTestBody(provider, config, 'ok')),
    signal
  });
  if (!response.ok) return { name: 'completion', ok: false, endpoint: target, error: await responseError(response) };
  return { name: 'completion', ok: true, endpoint: target };
}

async function testStructuredOutput({ provider, baseURL, config, signal }) {
  const target = provider === 'ollama' ? joinProviderURL(baseURL, 'chat') : joinProviderURL(baseURL, 'chat/completions');
  const response = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(provider === 'ollama' ? {} : authHeaders(config.apiKey)) },
    body: JSON.stringify(buildCompletionTestBody(provider, config, 'ok')),
    signal
  });
  if (!response.ok) return { name: 'schema-output', ok: false, endpoint: target, error: await responseError(response) };
  const data = await response.json();
  const text = provider === 'ollama' ? data?.message?.content : data?.choices?.[0]?.message?.content;
  return { name: 'schema-output', ok: String(text || '').length > 0, endpoint: target };
}

const COMPAT_SUFFIXES = ['/api/claudecode', '/api/anthropic', '/apps/anthropic', '/api/coding', '/claudecode', '/anthropic', '/step_plan', '/coding', '/claude'];

function buildCompletionTestBody(provider, config, content) {
  return { model: config.model || defaultModelForTest(provider), messages: [{ role: 'user', content }], stream: false };
}

function defaultModelForTest(provider) {
  return provider === 'ollama' ? 'qwen2.5-coder:7b' : 'gpt-4.1-mini';
}

async function responseError(response) {
  const text = await response.text();
  return `${response.status} ${response.statusText}${text ? `: ${truncateBody(text)}` : ''}`;
}

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
