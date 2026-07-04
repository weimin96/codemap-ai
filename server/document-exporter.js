const DOCUMENT_NAMES = [
  'PROJECT_MAP.md',
  'MODULES.md',
  'CORE_FLOWS.md',
  'DATA_MODEL.md',
  'RISK_REGISTER.md',
  'READING_PLAN.md',
  'QUESTIONS.md'
];

export function buildDocumentSet({ report, scan }) {
  if (!report) throw new Error('No report available for document export. Run analysis first.');
  const docs = {
    'PROJECT_MAP.md': projectMapDocument(report, scan),
    'MODULES.md': modulesDocument(report),
    'CORE_FLOWS.md': flowsDocument(report),
    'DATA_MODEL.md': dataModelDocument(report),
    'RISK_REGISTER.md': risksDocument(report),
    'READING_PLAN.md': readingPlanDocument(report),
    'QUESTIONS.md': questionsDocument(report)
  };
  return { generatedAt: new Date().toISOString(), names: DOCUMENT_NAMES, docs };
}

function projectMapDocument(report, scan) {
  const overview = report.projectOverview || {};
  const quality = report.analysisQuality || {};
  return joinSections([
    heading('Project Map'),
    line('项目名称', overview.name || '未识别'),
    line('项目类型', overview.type || '未识别'),
    line('技术栈', listInline(overview.techStack)),
    line('启动方式', overview.startup || '未识别'),
    paragraph(overview.summary),
    heading('Analysis Quality'),
    line('扫描文件', quality.scannedFiles ?? scan?.totalFiles ?? 0),
    line('索引符号', quality.indexedSymbols ?? scan?.totalSymbols ?? 0),
    line('上下文文件', quality.contextFiles?.length || 0),
    line('跳过文件', quality.skippedFiles?.length || 0),
    line('解析告警', quality.parseWarnings?.length || 0),
    heading('Entrypoints'),
    table(['名称', '路径', '类型', '可信度'], (report.entrypoints || []).map((item) => [item.name, item.path, item.kind, item.confidence])),
    heading('Architecture'),
    paragraph(report.architecture?.summary || ''),
    codeBlock(report.architecture?.mermaid || report.mermaid || '')
  ]);
}

function modulesDocument(report) {
  const sections = [heading('Modules')];
  for (const module of report.modules || []) {
    sections.push(heading(module.name || module.id || '未命名模块'));
    sections.push(line('状态', module.verificationStatus || 'ai_guess'));
    sections.push(line('优先级', module.priority || ''));
    sections.push(line('可信度', module.confidence || ''));
    sections.push(paragraph(module.summary || module.responsibility || ''));
    sections.push(list('路径', module.paths || []));
    sections.push(list('职责', module.responsibilities || []));
    sections.push(list('数据实体', module.dataEntities || []));
    sections.push(evidenceBlock(module.evidence));
  }
  return joinSections(sections);
}

function flowsDocument(report) {
  const sections = [heading('Core Flows')];
  for (const flow of report.flows || []) {
    sections.push(heading(flow.name || flow.id || '未命名链路'));
    sections.push(line('状态', flow.verificationStatus || 'ai_guess'));
    sections.push(line('触发', flow.trigger || ''));
    sections.push(line('优先级', flow.priority || ''));
    sections.push(line('可信度', flow.confidence || ''));
    sections.push(list('数据读取', flow.dataReads || []));
    sections.push(list('数据写入', flow.dataWrites || []));
    sections.push(list('外部调用', flow.externalCalls || []));
    sections.push(list('推荐断点', flow.breakpoints || []));
    sections.push(table(['顺序', '文件', '符号', '说明'], (flow.steps || []).map((step) => [step.order, step.path, step.symbol || '', step.description])));
    sections.push(codeBlock(flow.sequenceDiagram || flow.mermaid || ''));
  }
  return joinSections(sections);
}

function dataModelDocument(report) {
  const dataModel = report.dataModel || {};
  return joinSections([
    heading('Data Model'),
    heading('Entities'),
    table(['名称', '模块', '状态', '说明'], (dataModel.entities || []).map((entity) => [entity.name, entity.moduleId || '', entity.verificationStatus || 'ai_guess', entity.description || ''])),
    heading('Relations'),
    table(['来源', '目标', '类型', '原因'], (dataModel.relations || []).map((relation) => [relation.from, relation.to, relation.type, relation.reason])),
    heading('State Machines'),
    ...((dataModel.stateMachines || []).map((machine) => joinSections([
      heading(`${machine.entity || '实体'} · ${machine.field || '字段'}`),
      list('状态', machine.states || []),
      table(['从', '到', '触发'], (machine.transitions || []).map((transition) => [transition.from, transition.to, transition.trigger]))
    ])))
  ]);
}

function risksDocument(report) {
  const rows = (report.risks || []).map((risk) => [
    risk.level,
    risk.title,
    risk.category || '',
    risk.moduleId || '',
    risk.flowId || '',
    risk.verificationStatus || 'ai_guess',
    risk.verify || ''
  ]);
  return joinSections([
    heading('Risk Register'),
    table(['等级', '标题', '类型', '模块', '链路', '状态', '验证方式'], rows),
    ...((report.risks || []).map((risk) => joinSections([
      heading(risk.title || '未命名风险'),
      paragraph(risk.reason || ''),
      paragraph(risk.impact || ''),
      list('验证步骤', risk.verifySteps || []),
      list('建议测试', risk.suggestedTests || []),
      evidenceBlock(risk.evidence)
    ])))
  ]);
}

function readingPlanDocument(report) {
  return joinSections([
    heading('Reading Plan'),
    table(['时间盒', '目标', '文件', '产出'], (report.readingPlan || []).map((item) => [item.timebox, item.goal, listInline(item.files), item.output]))
  ]);
}

function questionsDocument(report) {
  return joinSections([
    heading('Questions'),
    list('待确认问题', report.unknowns || []),
    heading('Parse Warnings'),
    table(['文件', '原因'], (report.analysisQuality?.parseWarnings || []).map((warning) => [warning.path, warning.reason])),
    heading('Skipped Files'),
    table(['文件', '原因'], (report.analysisQuality?.skippedFiles || []).map((file) => [file.path, file.reason]))
  ]);
}

function heading(text) {
  return `## ${text}`;
}

function paragraph(value) {
  return value ? String(value) : '';
}

function line(label, value) {
  return `**${label}：** ${value ?? ''}`;
}

function list(title, items) {
  if (!items?.length) return `**${title}：** 无`;
  return [`**${title}：**`, ...items.map((item) => `- ${item}`)].join('\n');
}

function listInline(items) {
  return Array.isArray(items) && items.length ? items.join('、') : '无';
}

function table(headers, rows) {
  if (!rows.length) return '无';
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function evidenceBlock(evidence) {
  const items = Array.isArray(evidence) ? evidence : [];
  if (!items.length) return '**证据：** 无';
  return ['**证据：**', ...items.map((item) => `- ${item.path}${item.startLine ? `:${item.startLine}` : ''} ${item.reason || ''}`)].join('\n');
}

function codeBlock(value) {
  if (!value) return '';
  return ['```', value, '```'].join('\n');
}

function joinSections(sections) {
  return sections.filter((section) => String(section || '').trim()).join('\n\n');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}
