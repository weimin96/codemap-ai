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
  return parseAskAnswer(result.text);
}

const SYSTEM_PROMPT = `你是“项目快速接管工作台”的代码理解引擎。用户刚接手陌生项目，需要先通过你建立第一版项目地图，然后本人快速验证。

要求：
- 只基于提供的目录和代码片段分析，不要编造。
- 每个关键结论标注 confidence: fact | guess | unknown。
- 结论必须绑定代码证据；证据不足时使用 unknown，不要补故事。
- 按四个阶段提取信息：项目总览、模块分析、链路分析、风险与待验证问题。
- 阶段分析只用于组织判断，最终只输出严格 JSON，不要输出 Markdown、解释、推理过程或代码围栏。
- flows.steps 必须尽量绑定 path、symbol、startLine、endLine；不知道行号可省略。
- flows 每条链路必须包含数据读取、数据写入、外部调用、推荐断点和不确定点。
- 顶层 mermaid 输出 2-5 条核心链路的总览 flowchart TD。

四阶段输出目标：
1. 项目总览：判断项目类型、技术栈、启动方式、入口候选和分析质量。
2. 模块分析：按业务模块而不是技术层分组，输出模块职责、能力、入口、依赖、实体和证据。
3. 链路分析：从入口到服务、数据读写、外部调用、状态变化和断点，形成可验证剧本。
4. 风险与待验证问题：风险必须关联模块、链路、影响、验证步骤和代码证据。

JSON 结构：
{
  "generatedBy": "ai",
  "projectOverview": {"name":"", "type":"", "techStack":[], "startup":"", "confidence":"fact|guess|unknown", "summary":""},
  "analysisQuality": {"scannedFiles":0, "indexedSymbols":0, "contextFiles":[], "skippedFiles":[], "parseWarnings":[], "confidence":"fact|guess|unknown", "tokenBudget":{"max":0,"used":0}},
  "architecture": {"summary":"", "mermaid":"flowchart TD\n  A[入口] --> B[模块]", "evidence":[{"path":"", "symbol":"", "startLine":1, "endLine":1, "reason":"", "confidence":"fact|guess|unknown"}]},
  "entrypoints": [{"name":"", "path":"", "kind":"", "confidence":"fact|guess|unknown", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}],
  "modules": [{"id":"", "name":"", "paths":[], "summary":"", "responsibility":"", "responsibilities":[], "businessCapabilities":[{"name":"", "description":"", "importance":"core|important|supporting", "evidence":[{"path":"", "symbol":"", "startLine":1, "endLine":1, "reason":"", "confidence":"fact|guess|unknown"}]}], "entrypoints":[{"name":"", "path":"", "method":"", "route":"", "kind":"", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}], "dependencies":[{"moduleId":"", "reason":"", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}], "dataEntities":[], "coreFlows":[], "keyFiles":[{"path":"", "symbol":"", "startLine":1, "endLine":1, "reason":"", "confidence":"fact|guess|unknown"}], "risks":[], "priority":"P0|P1|P2|P3", "confidence":"fact|guess|unknown", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}],
  "flows": [{"id":"", "kind":"api|page|cli|worker|consumer|job|unknown", "name":"", "trigger":"", "priority":"P0|P1|P2|P3", "confidence":"fact|guess|unknown", "steps":[{"order":1,"path":"","symbol":"","startLine":1,"endLine":1,"description":"","confidence":"fact|guess|unknown"}], "dataReads":[], "dataWrites":[], "externalCalls":[], "breakpoints":[], "unknowns":[], "notes":[], "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}], "mermaid":"flowchart TD\n  A[触发] --> B[入口]", "sequenceDiagram":"sequenceDiagram\n  participant A as 触发"}],
  "dataModel": {"entities":[{"id":"", "name":"", "description":"", "moduleId":"", "keyFields":[], "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}], "relations":[{"from":"", "to":"", "type":"", "reason":"", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}], "stateMachines":[{"entity":"", "field":"", "states":[], "transitions":[{"from":"", "to":"", "trigger":"", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}]}], "keyFields":[{"entity":"", "field":"", "reason":"", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}], "risks":[{"title":"", "reason":"", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}]},
  "risks": [{"id":"", "title":"", "level":"high|medium|low", "category":"permission|state|idempotency|transaction|concurrency|cache|external|test|data|ai-change", "moduleId":"", "flowId":"", "path":"", "startLine":1, "endLine":1, "reason":"", "impact":"", "verify":"", "verifySteps":[], "suggestedTests":[], "confidence":"fact|guess|unknown", "evidence":[{"path":"", "reason":"", "confidence":"fact|guess|unknown"}]}],
  "readingPlan": [{"timebox":"", "goal":"", "files":[], "output":""}],
  "unknowns": [],
  "evidenceIndex": {"files":[{"path":"", "symbol":"", "startLine":1, "endLine":1, "reason":"", "confidence":"fact|guess|unknown"}]},
  "mermaid": "flowchart TD\n  A[触发] --> B[入口]"
}`;

const ASK_SYSTEM_PROMPT = `你是项目快速接管助手。回答必须围绕当前文件、选中代码、当前链路或风险点。不要泛泛解释。

要求：
- 只基于当前上下文回答。
- 如果证据不足，conclusion 必须直接说明“不确定”。
- evidence 和 relatedFiles 必须引用具体文件路径；不知道行号可省略。
- 输出必须是严格 JSON，不要 Markdown 代码围栏，不要输出 JSON 以外的文字。

JSON 结构：
{
  "conclusion": "",
  "evidence": [{"path":"", "symbol":"", "startLine":1, "endLine":1, "reason":"", "confidence":"fact|guess|unknown"}],
  "risks": [],
  "nextActions": [],
  "relatedFiles": [{"path":"", "symbol":"", "startLine":1, "endLine":1, "reason":"", "confidence":"fact|guess|unknown"}],
  "confidence": "fact|guess|unknown",
  "markdown": ""
}`;

function buildAnalyzePrompt(scan, chunks, contextPack) {
  const fileList = scan.keyFiles.slice(0, 80).map((f) => {
    const symbolSummary = (f.symbols || []).slice(0, 8).map((s) => `${s.kind}:${s.name}@L${s.startLine}`).join(', ');
    return `${f.priority} | ${f.role} | ${f.path} | ${f.language}${symbolSummary ? ` | symbols: ${symbolSummary}` : ''}`;
  }).join('\n');
  const contextFiles = (contextPack?.files || []).map((f) => `${f.priority} | score=${f.score} | ${f.path} | ${f.language} | ${f.charCount} chars`).join('\n');
  const code = chunks.map((c) => {
    const symbols = (c.symbols || []).slice(0, 24).map((s) => `${s.kind} ${s.name} L${s.startLine}-L${s.endLine}: ${s.signature}`).join('\n');
    return `--- FILE: ${c.path}\nROLE: ${c.role}\nLANG: ${c.language}\nSYMBOLS:\n${symbols || '-'}\n${c.content.slice(0, 24000)}`;
  }).join('\n\n');
  return `项目根目录：${scan.root}
扫描概况：files=${scan.totalFiles}, dirs=${scan.totalDirs}, symbols=${scan.totalSymbols || 0}
上下文预算：${contextPack?.budget?.usedChars || 0}/${contextPack?.budget?.maxChars || 0} chars
估算 token：${Math.ceil((contextPack?.budget?.usedChars || 0) / 3)}/${Math.ceil((contextPack?.budget?.maxChars || 0) / 3)}

请按以下四阶段提取事实，但最终只输出一个完整 JSON。

阶段 1：项目总览分析
输入重点：目录树、README、配置、入口候选、Repo Map 摘要。
输出重点：projectOverview、entrypoints、analysisQuality、architecture。

候选关键文件：
${fileList}

Repo Map：
${JSON.stringify(scan.repoMap || {}, null, 2)}

目录树摘要：
${JSON.stringify(scan.tree.slice(0, 220), null, 2)}

阶段 2：模块分析
输入重点：repoMap.modules、关键文件路径、入口文件、service/model/repository 等命名线索。
输出重点：modules，且模块必须偏业务领域，不要只按 components/services/models 这类技术层拆分。

结构模块候选：
${JSON.stringify(scan.repoMap?.modules || [], null, 2)}

阶段 3：链路分析
输入重点：入口文件、模块、相关 service/model/repository、符号摘要。
输出重点：flows、flows.steps、dataReads、dataWrites、externalCalls、breakpoints、sequenceDiagram。

阶段 4：风险与待验证问题
输入重点：模块、链路、数据实体、配置、外部调用、可变状态、测试缺口。
输出重点：risks、dataModel、unknowns、readingPlan、evidenceIndex。

本次分析使用的上下文文件：
${contextFiles}

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

export function parseAskAnswer(text) {
  try {
    return normalizeAskAnswer(parseJsonResult(text));
  } catch {
    return normalizeAskAnswer({ markdown: text, conclusion: text.trim() ? text.trim().slice(0, 240) : '不确定' });
  }
}

function normalizeAskAnswer(answer) {
  return {
    conclusion: answer.conclusion || '不确定',
    evidence: normalizeCodeReferences(answer.evidence),
    risks: asStringArray(answer.risks),
    nextActions: asStringArray(answer.nextActions),
    relatedFiles: normalizeCodeReferences(answer.relatedFiles),
    confidence: normalizeConfidence(answer.confidence),
    markdown: answer.markdown || ''
  };
}

function normalizeCodeReferences(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { path: item, reason: '相关文件', confidence: 'guess' };
    return {
      path: item.path || '',
      symbol: item.symbol || '',
      startLine: item.startLine,
      endLine: item.endLine,
      reason: item.reason || '相关文件',
      confidence: normalizeConfidence(item.confidence)
    };
  }).filter((item) => item.path);
}

function asStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeConfidence(value) {
  if (value === 'fact' || value === 'guess' || value === 'unknown') return value;
  return 'unknown';
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
