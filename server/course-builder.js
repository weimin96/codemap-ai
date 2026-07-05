import { readTextFileSafe } from './fs-utils.js';

const COURSE_VERSION = 'course-v1';
const MAX_SNIPPETS = 3;
const MAX_SNIPPET_LINES = 15;

export async function buildCourseMaterials({ root, report, scan = null, codeGraph = null }) {
  if (!report) throw new Error('No report available for course generation. Run analysis first.');
  const briefs = await buildModuleBriefs({ root, report });
  const modules = buildCourseModules({ report, briefs });
  return {
    version: COURSE_VERSION,
    generatedAt: new Date().toISOString(),
    projectName: report.projectOverview?.name || projectNameFromScan(scan),
    courseModules: modules,
    moduleBriefs: briefs,
    evidenceSummary: {
      files: scan?.totalFiles || scan?.files?.length || 0,
      symbols: scan?.totalSymbols || scan?.repoMap?.totals?.symbols || 0,
      graphNodes: codeGraph?.nodes?.length || codeGraph?.totals?.nodes || 0,
      graphEdges: codeGraph?.edges?.length || codeGraph?.totals?.edges || 0
    }
  };
}

export async function buildCourseExport({ root, report, scan = null, codeGraph = null }) {
  const course = await buildCourseMaterials({ root, report, scan, codeGraph });
  const docs = {
    'index.html': renderIndex(course),
    'styles.css': COURSE_CSS,
    'main.js': COURSE_JS,
    'module-briefs.json': JSON.stringify(course.moduleBriefs, null, 2)
  };
  course.courseModules.forEach((module, index) => {
    docs[`modules/${String(index + 1).padStart(2, '0')}-${module.id}.html`] = renderModule(module, course.moduleBriefs.find((brief) => brief.id === module.briefId));
  });
  return { names: Object.keys(docs), docs, course };
}

async function buildModuleBriefs({ root, report }) {
  const modules = report.modules || [];
  const flows = report.flows || [];
  const risks = report.risks || [];
  return [
    await overviewBrief({ root, report, flows, risks }),
    await actorsBrief({ root, modules, flows, risks }),
    await flowsBrief({ root, flows }),
    await dataBrief({ root, report }),
    await riskBrief({ root, risks }),
    await handoffBrief({ root, report })
  ].filter(Boolean);
}

async function overviewBrief({ root, report, flows, risks }) {
  const refs = [...collectEvidence(report.entrypoints), ...collectFlowRefs(flows.slice(0, 1))];
  return {
    id: 'overview',
    title: '这个项目到底做什么',
    openingHook: firstFlow(flows)?.trigger || report.projectOverview?.summary || '从一次核心用户操作开始理解项目。',
    whyCare: '先知道产品行为，再判断代码变化应该落在哪些模块。',
    actors: actorNames(report.modules),
    snippets: await readSnippets(root, refs, '项目入口或核心路径'),
    quizIdeas: [scenarioQuiz('用户说“这个功能突然不可用”，你先做什么？', ['直接改 UI', '先定位入口和核心链路', '重装依赖', '删除缓存'], 1, '接管时先从入口、链路和证据定位影响范围。')],
    riskLinks: risks.slice(0, 2).map((risk) => risk.id || risk.title).filter(Boolean)
  };
}

async function actorsBrief({ root, modules, flows, risks }) {
  const refs = collectModuleRefs(modules.slice(0, 4));
  return {
    id: 'actors',
    title: '主要角色：模块如何分工',
    openingHook: '把代码库看成一组协作角色，而不是一堆文件。',
    whyCare: '你能更准确地要求 AI 把新逻辑放到正确层。',
    actors: actorNames(modules),
    snippets: await readSnippets(root, refs, '模块职责证据'),
    quizIdeas: [scenarioQuiz('要新增一个业务能力，最可靠的变更判断是什么？', ['只找最大文件', '看模块职责、入口和依赖', '只改 README', '只看文件名'], 1, '模块职责、入口和依赖共同决定变更范围。')],
    flowLinks: flows.slice(0, 3).map((flow) => flow.id || flow.name).filter(Boolean),
    riskLinks: risks.slice(0, 2).map((risk) => risk.id || risk.title).filter(Boolean)
  };
}

async function flowsBrief({ root, flows }) {
  const flow = firstFlow(flows);
  const refs = collectFlowRefs(flow ? [flow] : []);
  return flow ? {
    id: 'core-flow',
    title: '一次核心操作如何流动',
    openingHook: flow.trigger || '跟踪一次请求或操作从入口到结果的路径。',
    whyCare: '当结果不对时，你能沿着链路逐段验证。',
    actors: flow.steps?.map((step) => step.symbol || step.path).filter(Boolean).slice(0, 6) || [],
    snippets: await readSnippets(root, refs, '核心链路步骤'),
    quizIdeas: [scenarioQuiz('用户报告结果没有更新，你应该先沿什么路径排查？', ['随机搜索所有文件', '按 flow steps 从入口到写入点排查', '只看样式文件', '只问模型重写'], 1, '链路步骤给出可验证的排查顺序。')],
    flowLinks: [flow.id || flow.name].filter(Boolean),
    riskLinks: flow.breakpoints || []
  } : null;
}

async function dataBrief({ root, report }) {
  const dataModel = report.dataModel || {};
  const refs = [
    ...collectEvidence(dataModel.entities),
    ...collectEvidence(dataModel.relations),
    ...collectEvidence(dataModel.keyFields)
  ];
  return {
    id: 'data-model',
    title: '数据怎么保存和变化',
    openingHook: '先弄清楚数据叫什么、在哪里产生、在哪里被修改。',
    whyCare: '状态或数据问题通常不是单点 bug，而是读写路径不一致。',
    actors: (dataModel.entities || []).map((entity) => entity.name).filter(Boolean),
    snippets: await readSnippets(root, refs, '数据结构或状态变化'),
    quizIdeas: [scenarioQuiz('用户看到旧数据，你优先验证什么？', ['按钮颜色', '数据读写路径和缓存/状态更新点', 'logo 文件', 'package name'], 1, '数据问题要先看读写路径、缓存和状态变化。')],
    riskLinks: (dataModel.risks || []).map((risk) => risk.title).filter(Boolean)
  };
}

async function riskBrief({ root, risks }) {
  const refs = collectRiskRefs(risks.slice(0, 4));
  return {
    id: 'risk-debugging',
    title: '哪里最容易坏，怎么验证',
    openingHook: '把风险当成排查清单，而不是报告末尾的备注。',
    whyCare: '你能让 AI 先写验证步骤，再改代码，减少盲改。',
    actors: risks.slice(0, 5).map((risk) => risk.title).filter(Boolean),
    snippets: await readSnippets(root, refs, '风险证据'),
    quizIdeas: [scenarioQuiz('AI 修改后测试偶发失败，你先要求它补什么？', ['更多动画', '最小复现和验证步骤', '改变量名', '删除风险说明'], 1, '风险要转成可执行验证步骤。')],
    riskLinks: risks.slice(0, 5).map((risk) => risk.id || risk.title).filter(Boolean)
  };
}

async function handoffBrief({ root, report }) {
  const refs = report.readingPlan?.flatMap((item) => (item.files || []).map((path) => ({ path, reason: item.goal }))) || [];
  return {
    id: 'handoff-plan',
    title: '下一步怎么接手',
    openingHook: '把学习路线变成可执行的接管动作。',
    whyCare: '读代码的目标是形成可验证的修改判断，而不是记文件名。',
    actors: (report.readingPlan || []).map((item) => item.goal).filter(Boolean),
    snippets: await readSnippets(root, refs, '阅读路线文件'),
    quizIdeas: [scenarioQuiz('准备接手一个新功能前，最稳妥的输出是什么？', ['一份验证清单和影响文件列表', '只写一个长总结', '直接重构', '跳过风险'], 0, '接管输出应能指导下一次安全变更。')],
    riskLinks: []
  };
}

function buildCourseModules({ report, briefs }) {
  const modules = [
    courseModule({ brief: briefById(briefs, 'overview'), userAction: firstFlow(report.flows)?.trigger || '打开项目并触发核心操作', coreFiles: entrypointPaths(report), flows: firstIds(report.flows, 1), risks: firstIds(report.risks, 2) }),
    courseModule({ brief: briefById(briefs, 'actors'), userAction: '判断一个需求应该落在哪些模块', coreFiles: modulePaths(report.modules), flows: firstIds(report.flows, 3), risks: firstIds(report.risks, 2) }),
    courseModule({ brief: briefById(briefs, 'core-flow'), userAction: firstFlow(report.flows)?.trigger || '跟踪一次核心链路', coreFiles: flowPaths(firstFlow(report.flows)), flows: firstIds(report.flows, 1), risks: firstIds(report.risks, 2) }),
    courseModule({ brief: briefById(briefs, 'data-model'), userAction: '验证数据读写和状态变化', coreFiles: dataPaths(report.dataModel), flows: firstIds(report.flows, 2), risks: firstIds(report.risks, 2) }),
    courseModule({ brief: briefById(briefs, 'risk-debugging'), userAction: '把风险转成验证步骤', coreFiles: riskPaths(report.risks), flows: firstIds(report.flows, 2), risks: firstIds(report.risks, 5) }),
    courseModule({ brief: briefById(briefs, 'handoff-plan'), userAction: '按时间盒完成接管阅读', coreFiles: readingPlanPaths(report), flows: firstIds(report.flows, 2), risks: firstIds(report.risks, 3) })
  ].filter((module) => module.briefId);
  return modules.slice(0, 6);
}

function courseModule({ brief, userAction, coreFiles, flows, risks }) {
  if (!brief) return { briefId: '' };
  return {
    id: brief.id,
    title: brief.title,
    briefId: brief.id,
    userAction,
    whyCare: brief.whyCare,
    coreFiles: dedupe(coreFiles).slice(0, 8),
    flows,
    risks,
    codeTranslations: (brief.snippets || []).slice(0, 2).map((snippet) => ({
      path: snippet.path,
      startLine: snippet.startLine,
      endLine: snippet.endLine,
      code: snippet.code,
      plainEnglish: translateSnippet(snippet),
      roleInFlow: snippet.purpose
    })),
    quiz: brief.quizIdeas || []
  };
}

async function readSnippets(root, refs, purpose) {
  const snippets = [];
  for (const ref of dedupeRefs(refs).slice(0, MAX_SNIPPETS)) {
    const snippet = await readSnippet(root, ref, purpose || ref.reason || '证据片段');
    if (snippet) snippets.push(snippet);
  }
  return snippets;
}

async function readSnippet(root, ref, purpose) {
  if (!ref?.path) return null;
  try {
    const file = await readTextFileSafe(root, ref.path, 200_000);
    const lines = String(file.content || '').split(/\r?\n/);
    const startLine = clampLine(ref.startLine, lines.length);
    const requestedEnd = ref.endLine && Number(ref.endLine) >= startLine ? Number(ref.endLine) : startLine + 8;
    const endLine = Math.min(lines.length, startLine + MAX_SNIPPET_LINES - 1, requestedEnd);
    return {
      path: ref.path,
      startLine,
      endLine,
      purpose: purpose || ref.reason || '',
      code: lines.slice(startLine - 1, endLine).join('\n'),
      confidence: ref.confidence || 'guess'
    };
  } catch {
    return null;
  }
}

function scenarioQuiz(question, options, answerIndex, explanation) {
  return { type: 'scenario', question, options, answerIndex, explanation };
}

function translateSnippet(snippet) {
  const lineCount = Math.max(1, snippet.endLine - snippet.startLine + 1);
  return [`L${snippet.startLine}-${snippet.endLine} 是真实代码片段，共 ${lineCount} 行。`, `它在课程里的作用是：${snippet.purpose || '说明项目行为'}。`, '学习时先看输入、输出和错误路径，再回到对应 flow/risk 验证。'];
}

function collectModuleRefs(modules) {
  return modules.flatMap((module) => [
    ...(module.keyFiles || []),
    ...asEvidenceArray(module.evidence),
    ...(module.paths || []).map((path) => ({ path, reason: module.name }))
  ]);
}

function collectFlowRefs(flows) {
  return flows.flatMap((flow) => [
    ...(flow.evidence || []),
    ...(flow.steps || []).map((step) => ({ path: step.path, startLine: step.startLine, endLine: step.endLine, symbol: step.symbol, reason: step.description }))
  ]);
}

function collectRiskRefs(risks) {
  return risks.flatMap((risk) => [
    ...(risk.evidence || []),
    risk.path ? { path: risk.path, startLine: risk.startLine, endLine: risk.endLine, reason: risk.title } : null
  ].filter(Boolean));
}

function collectEvidence(items) {
  return (items || []).flatMap((item) => asEvidenceArray(item?.evidence));
}

function asEvidenceArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item?.path);
  if (typeof value === 'string' && value) return [{ path: value }];
  return [];
}

function firstFlow(flows = []) {
  return (flows || [])[0] || null;
}

function actorNames(modules = []) {
  return (modules || []).map((module) => module.name).filter(Boolean).slice(0, 8);
}

function entrypointPaths(report) {
  return (report.entrypoints || []).map((entry) => entry.path).filter(Boolean);
}

function modulePaths(modules = []) {
  return (modules || []).flatMap((module) => module.paths || []).filter(Boolean).slice(0, 10);
}

function flowPaths(flow) {
  return (flow?.steps || []).map((step) => step.path).filter(Boolean);
}

function dataPaths(dataModel = {}) {
  return [
    ...collectEvidence(dataModel.entities),
    ...collectEvidence(dataModel.relations),
    ...collectEvidence(dataModel.keyFields)
  ].map((ref) => ref.path).filter(Boolean);
}

function riskPaths(risks = []) {
  return collectRiskRefs(risks).map((ref) => ref.path).filter(Boolean);
}

function readingPlanPaths(report) {
  return (report.readingPlan || []).flatMap((item) => item.files || []).filter(Boolean);
}

function firstIds(items = [], limit = 3) {
  return (items || []).slice(0, limit).map((item) => item.id || item.name || item.title).filter(Boolean);
}

function briefById(briefs, id) {
  return briefs.find((brief) => brief.id === id);
}

function dedupe(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function dedupeRefs(refs) {
  const seen = new Set();
  return (refs || []).filter((ref) => {
    if (!ref?.path) return false;
    const key = `${ref.path}:${ref.startLine || 1}:${ref.endLine || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampLine(value, lineCount) {
  const line = Number(value) || 1;
  return Math.max(1, Math.min(line, Math.max(1, lineCount)));
}

function projectNameFromScan(scan) {
  return scan?.repoMap?.name || 'codemap-ai course';
}

function renderIndex(course) {
  const nav = course.courseModules.map((module, index) => `<a href="modules/${String(index + 1).padStart(2, '0')}-${escapeAttr(module.id)}.html">${escapeHtml(module.title)}</a>`).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(course.projectName)} 学习课程</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">codemap-ai Course Mode</p>
      <h1>${escapeHtml(course.projectName)} 学习课程</h1>
      <p>从项目行为出发，按模块、链路、数据、风险和接管步骤学习。所有片段都保留真实文件路径和行号。</p>
    </section>
    <nav class="module-nav">${nav}</nav>
  </main>
  <script src="main.js"></script>
</body>
</html>`;
}

function renderModule(module, brief) {
  const snippets = (module.codeTranslations || []).map(renderTranslationBlock).join('\n');
  const quiz = (module.quiz || []).map(renderQuiz).join('\n');
  return `<section class="module">
  <p class="eyebrow">${escapeHtml(module.userAction)}</p>
  <h2>${escapeHtml(module.title)}</h2>
  <p class="why">${escapeHtml(module.whyCare)}</p>
  <div class="actors">${(brief?.actors || []).map((actor) => `<span>${escapeHtml(actor)}</span>`).join('')}</div>
  ${snippets}
  ${quiz}
  <div class="evidence">
    <h3>证据文件</h3>
    <ul>${(module.coreFiles || []).map((file) => `<li>${escapeHtml(file)}</li>`).join('')}</ul>
  </div>
</section>`;
}

function renderTranslationBlock(block) {
  return `<div class="translation">
  <pre><code>${escapeHtml(block.code || '')}</code></pre>
  <div>${(block.plainEnglish || []).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>
  <p class="meta">${escapeHtml(block.path)}:${block.startLine}-${block.endLine}</p>
</div>`;
}

function renderQuiz(quiz) {
  return `<div class="quiz" data-answer="${quiz.answerIndex}">
  <h3>${escapeHtml(quiz.question)}</h3>
  ${(quiz.options || []).map((option, index) => `<button type="button" data-index="${index}">${escapeHtml(option)}</button>`).join('')}
  <p class="explanation">${escapeHtml(quiz.explanation)}</p>
</div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeAttr(value) {
  return String(value ?? '').replace(/[^a-z0-9-]/gi, '-');
}

const COURSE_CSS = `:root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f8fafc}body{margin:0}.shell{max-width:1040px;margin:0 auto;padding:48px 24px}.hero,.module{background:white;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 10px 30px rgba(15,23,42,.06)}.eyebrow{color:#2563eb;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h1,h2{margin:8px 0;color:#0f172a}.module-nav{display:grid;gap:12px;margin-top:24px}.module-nav a{display:block;padding:16px 18px;border:1px solid #dbeafe;border-radius:16px;background:#eff6ff;color:#1d4ed8;text-decoration:none;font-weight:700}.why{color:#475569}.actors{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.actors span{border:1px solid #dbeafe;background:#eff6ff;border-radius:999px;padding:6px 10px;font-size:13px}.translation{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);gap:18px;margin:24px 0}.translation pre{margin:0;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:16px;padding:18px}.translation p{line-height:1.6}.meta{grid-column:1/-1;color:#64748b;font-size:12px}.quiz{border:1px solid #fde68a;background:#fffbeb;border-radius:16px;padding:18px;margin:20px 0}.quiz button{display:block;width:100%;margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid #fcd34d;background:white;text-align:left}.quiz button.correct{border-color:#22c55e;background:#ecfdf5}.quiz button.wrong{border-color:#ef4444;background:#fef2f2}.explanation{display:none}.quiz.answered .explanation{display:block}.evidence li{font-family:ui-monospace,monospace;font-size:13px}@media(max-width:760px){.translation{grid-template-columns:1fr}}`;

const COURSE_JS = `document.querySelectorAll('.quiz').forEach((quiz)=>{quiz.querySelectorAll('button').forEach((button)=>{button.addEventListener('click',()=>{quiz.classList.add('answered');const answer=Number(quiz.dataset.answer);quiz.querySelectorAll('button').forEach((item)=>{const index=Number(item.dataset.index);item.classList.toggle('correct',index===answer);item.classList.toggle('wrong',item===button&&index!==answer);});});});});`;
