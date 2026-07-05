import { readTextFileSafe } from './fs-utils.js';

export async function verifyReportEvidence({ root, scan, report }) {
  if (!report || typeof report !== 'object') return report;
  const filesByPath = new Map((scan?.files || []).filter((file) => !file.type || file.type === 'file').map((file) => [file.path, file]));
  const lineCounts = new Map();
  const next = structuredCloneSafe(report);
  const unsupportedClaims = [];

  for (const claim of collectClaims(next)) {
    const evidence = claim.evidence().filter(Boolean);
    if (!evidence.length) {
      markUnsupported(claim, unsupportedClaims, 'missing_evidence', []);
      continue;
    }
    const invalid = [];
    let hasValidEvidence = false;
    for (const reference of evidence) {
      const result = await verifyReference({ root, filesByPath, lineCounts, reference });
      if (result.valid) {
        hasValidEvidence = true;
      } else {
        reference.confidence = 'unknown';
        invalid.push({ path: reference.path || '', reason: result.reason });
      }
    }
    if (!hasValidEvidence) markUnsupported(claim, unsupportedClaims, 'invalid_evidence', invalid);
  }

  const analysisQuality = next.analysisQuality && typeof next.analysisQuality === 'object' && !Array.isArray(next.analysisQuality)
    ? { ...next.analysisQuality }
    : {};
  analysisQuality.unsupportedClaims = [
    ...(Array.isArray(analysisQuality.unsupportedClaims) ? analysisQuality.unsupportedClaims : []),
    ...unsupportedClaims
  ];
  next.analysisQuality = analysisQuality;
  return next;
}

function collectClaims(report) {
  const claims = [];
  if (report.architecture?.summary || arrayOf(report.architecture?.evidence).length) {
    pushClaim(claims, 'architecture', report.architecture?.summary || 'architecture', report.architecture, () => arrayOf(report.architecture?.evidence));
  }
  for (const entrypoint of arrayOf(report.entrypoints)) {
    pushClaim(claims, 'entrypoint', entrypoint.name || entrypoint.path, entrypoint, () => arrayOf(entrypoint.evidence));
  }
  for (const module of arrayOf(report.modules)) {
    pushClaim(claims, 'module', module.name || module.id, module, () => arrayOf(module.evidence));
    for (const capability of arrayOf(module.businessCapabilities)) {
      pushClaim(claims, 'businessCapability', capability.name, capability, () => arrayOf(capability.evidence));
    }
    for (const entrypoint of arrayOf(module.entrypoints)) {
      pushClaim(claims, 'moduleEntrypoint', entrypoint.name || entrypoint.path, entrypoint, () => arrayOf(entrypoint.evidence));
    }
    for (const dependency of arrayOf(module.dependencies)) {
      pushClaim(claims, 'moduleDependency', dependency.moduleId, dependency, () => arrayOf(dependency.evidence));
    }
    for (const keyFile of arrayOf(module.keyFiles)) {
      pushClaim(claims, 'moduleKeyFile', keyFile.path || keyFile.symbol, keyFile, () => [keyFile]);
    }
  }
  for (const flow of arrayOf(report.flows)) {
    pushClaim(claims, 'flow', flow.name || flow.id, flow, () => [...arrayOf(flow.evidence), ...arrayOf(flow.steps)]);
  }
  for (const entity of arrayOf(report.dataModel?.entities)) {
    pushClaim(claims, 'dataEntity', entity.name || entity.id, entity, () => arrayOf(entity.evidence));
  }
  for (const relation of arrayOf(report.dataModel?.relations)) {
    pushClaim(claims, 'dataRelation', `${relation.from || ''}->${relation.to || ''}`, relation, () => arrayOf(relation.evidence));
  }
  for (const machine of arrayOf(report.dataModel?.stateMachines)) {
    for (const transition of arrayOf(machine.transitions)) {
      pushClaim(claims, 'stateTransition', `${machine.entity || ''}.${machine.field || ''}`, transition, () => arrayOf(transition.evidence));
    }
  }
  for (const field of arrayOf(report.dataModel?.keyFields)) {
    pushClaim(claims, 'keyField', `${field.entity || ''}.${field.field || ''}`, field, () => arrayOf(field.evidence));
  }
  for (const risk of arrayOf(report.dataModel?.risks)) {
    pushClaim(claims, 'dataRisk', risk.title, risk, () => arrayOf(risk.evidence));
  }
  for (const risk of arrayOf(report.risks)) {
    pushClaim(claims, 'risk', risk.title || risk.id, risk, () => arrayOf(risk.evidence));
  }
  return claims;
}

function pushClaim(claims, kind, label, target, evidence) {
  if (!target || typeof target !== 'object') return;
  claims.push({ kind, label: String(label || kind), target, evidence });
}

async function verifyReference({ root, filesByPath, lineCounts, reference }) {
  if (!reference || typeof reference !== 'object') return { valid: false, reason: 'reference_not_object' };
  if (!reference.path) return { valid: false, reason: 'missing_path' };
  const file = filesByPath.get(reference.path);
  if (!file) return { valid: false, reason: 'path_not_in_scan' };
  if (reference.startLine || reference.endLine) {
    const startLine = Number(reference.startLine || reference.endLine);
    const endLine = Number(reference.endLine || reference.startLine);
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine <= 0 || endLine < startLine) {
      return { valid: false, reason: 'invalid_line_range' };
    }
    const count = await getLineCount({ root, path: reference.path, lineCounts });
    if (count > 0 && endLine > count) return { valid: false, reason: 'line_range_out_of_bounds' };
  }
  if (reference.symbol && !symbolExists(file, reference.symbol)) return { valid: false, reason: 'symbol_not_in_index' };
  return { valid: true };
}

async function getLineCount({ root, path, lineCounts }) {
  if (lineCounts.has(path)) return lineCounts.get(path);
  const file = await readTextFileSafe(root, path, 1_000_000);
  const count = file.content ? file.content.split(/\r?\n/).length : 0;
  lineCounts.set(path, count);
  return count;
}

function symbolExists(file, symbolName) {
  const symbols = arrayOf(file.symbols);
  if (!symbols.length) return false;
  return symbols.some((symbol) => symbol.name === symbolName || symbol.signature === symbolName || String(symbol.signature || '').includes(symbolName));
}

function markUnsupported(claim, unsupportedClaims, reason, invalidEvidence) {
  if (claim.target && typeof claim.target === 'object') claim.target.confidence = 'unknown';
  unsupportedClaims.push({
    kind: claim.kind,
    label: claim.label,
    reason,
    invalidEvidence
  });
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
