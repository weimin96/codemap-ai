import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOllama } from 'ollama-ai-provider-v2';

globalThis.AI_SDK_LOG_WARNINGS = false;

export function modelFromConfig(config = {}) {
  const provider = config.provider || process.env.PFO_AI_PROVIDER || 'openai-compatible';
  const modelName = config.model || process.env.OPENAI_MODEL || process.env.PFO_AI_MODEL || defaultModel(provider);
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || process.env.PFO_AI_API_KEY;
  const baseURL = config.baseURL || process.env.OPENAI_BASE_URL || process.env.PFO_AI_BASE_URL;

  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey, baseURL });
    return openai(modelName);
  }

  if (provider === 'ollama') {
    const ollama = createOllama({ baseURL: baseURL || 'http://127.0.0.1:11434/api' });
    return ollama(modelName || 'qwen2.5-coder:7b');
  }

  const compatible = createOpenAICompatible({
    name: provider === 'openai-compatible' || provider === 'custom' ? 'openai-compatible' : provider,
    apiKey,
    baseURL: baseURL || defaultBaseURL(provider)
  });
  return compatible(modelName);
}

function defaultModel(provider) {
  if (provider === 'ollama') return 'qwen2.5-coder:7b';
  if (provider === 'deepseek') return 'deepseek-v4-flash';
  if (provider === 'kimi') return 'kimi-k2.7-code';
  if (provider === 'zhipu') return 'glm-5.1';
  if (provider === 'siliconflow') return 'Qwen/Qwen3-Coder-480B-A35B-Instruct';
  if (provider === 'openrouter') return 'anthropic/claude-sonnet-4.5';
  return 'gpt-4.1-mini';
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

export async function analyzeWithAI({ scan, chunks, contextPack, config }) {
  const model = modelFromConfig(config);
  const prompt = buildAnalyzePrompt(scan, chunks, contextPack);
  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.15
  });
  return parseJsonResult(result.text);
}

export async function askWithAI({ question, context, config }) {
  const model = modelFromConfig(config);
  const prompt = buildAskPrompt(question, context);
  const result = await generateText({
    model,
    system: ASK_SYSTEM_PROMPT,
    prompt,
    temperature: 0.2
  });
  return result.text;
}

const SYSTEM_PROMPT = `你是“项目快速接管工作台”的代码理解引擎。用户刚接手陌生项目，需要先通过你建立第一版项目地图，然后本人快速验证。

要求：
- 只基于提供的目录和代码片段分析，不要编造。
- 每个关键结论标注 confidence: fact | guess | unknown。
- 优先速度和主干：入口、模块、核心链路、数据副作用、风险、阅读路线。
- 输出必须是严格 JSON，不要 Markdown，不要代码围栏。
- flows.steps 必须尽量绑定 path、symbol、startLine、endLine；不知道行号可省略。
- flows 每条链路必须包含数据读取、数据写入、外部调用、推荐断点和不确定点。
- flows.mermaid 输出该链路可渲染的 flowchart TD；flows.sequenceDiagram 可输出 sequenceDiagram。
- 顶层 mermaid 输出 2-5 条核心链路的总览 flowchart TD。

JSON 结构：
{
  "generatedBy": "ai",
  "projectOverview": {"name":"", "type":"", "techStack":[], "startup":"", "confidence":"fact|guess|unknown", "summary":""},
  "entrypoints": [{"name":"", "path":"", "kind":"", "confidence":"fact|guess|unknown", "evidence":""}],
  "modules": [{"name":"", "paths":[], "responsibility":"", "priority":"P0|P1|P2|P3", "confidence":"fact|guess|unknown", "evidence":""}],
  "flows": [{"id":"", "kind":"api|page|cli|worker|consumer|job|unknown", "name":"", "trigger":"", "priority":"P0|P1|P2|P3", "confidence":"fact|guess|unknown", "steps":[{"order":1,"path":"","symbol":"","startLine":1,"endLine":1,"description":"","confidence":"fact|guess|unknown"}], "dataReads":[], "dataWrites":[], "externalCalls":[], "breakpoints":[], "unknowns":[], "notes":[], "mermaid":"flowchart TD\n  A[触发] --> B[入口]", "sequenceDiagram":"sequenceDiagram\n  participant A as 触发"}],
  "risks": [{"title":"", "level":"high|medium|low", "path":"", "startLine":1, "endLine":1, "reason":"", "verify":""}],
  "readingPlan": [{"timebox":"", "goal":"", "files":[], "output":""}],
  "unknowns": [],
  "mermaid": "flowchart TD\n  A[触发] --> B[入口]"
}`;

const ASK_SYSTEM_PROMPT = `你是项目快速接管助手。回答必须围绕当前文件、选中代码、当前链路或风险点。不要泛泛解释。

回答结构：
1. 结论
2. 证据：引用具体文件/函数/代码片段
3. 可能风险或误解
4. 下一步验证动作

如果证据不足，直接说“不确定”，并说明需要打开或搜索哪些文件。`;

function buildAnalyzePrompt(scan, chunks, contextPack) {
  const fileList = scan.keyFiles.slice(0, 80).map((f) => {
    const symbolSummary = (f.symbols || []).slice(0, 8).map((s) => `${s.kind}:${s.name}@L${s.startLine}`).join(', ');
    return `${f.priority} | ${f.role} | ${f.path} | ${f.language}${symbolSummary ? ` | symbols: ${symbolSummary}` : ''}`;
  }).join('\n');
  const code = chunks.map((c) => {
    const symbols = (c.symbols || []).slice(0, 24).map((s) => `${s.kind} ${s.name} L${s.startLine}-L${s.endLine}: ${s.signature}`).join('\n');
    return `--- FILE: ${c.path}\nROLE: ${c.role}\nLANG: ${c.language}\nSYMBOLS:\n${symbols || '-'}\n${c.content.slice(0, 24000)}`;
  }).join('\n\n');
  return `项目根目录：${scan.root}
扫描概况：files=${scan.totalFiles}, dirs=${scan.totalDirs}, symbols=${scan.totalSymbols || 0}
上下文预算：${contextPack?.budget?.usedChars || 0}/${contextPack?.budget?.maxChars || 0} chars

候选关键文件：
${fileList}

Repo Map：
${JSON.stringify(scan.repoMap || {}, null, 2)}

目录树摘要：
${JSON.stringify(scan.tree.slice(0, 220), null, 2)}

本次分析使用的上下文文件：
${(contextPack?.files || []).map((f) => `${f.priority} | score=${f.score} | ${f.path} | ${f.language} | ${f.charCount} chars`).join('\n')}

关键文件内容：
${code}

请生成项目快速接管 JSON。`;
}

function buildAskPrompt(question, context) {
  return `用户问题：
${question}

当前上下文：
${JSON.stringify(context, null, 2)}

请基于上下文回答。`;
}

export function parseJsonResult(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI response is not valid JSON.');
  }
}
