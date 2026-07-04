const ALLOWED_STATUSES = new Set(['ai_guess', 'verified', 'rejected', 'pending', 'stale']);
const TARGETS = {
  module: { collection: 'modules', idFields: ['id', 'name'] },
  flow: { collection: 'flows', idFields: ['id', 'name'] },
  risk: { collection: 'risks', idFields: ['id', 'title'] },
  entity: { collection: 'dataModel.entities', idFields: ['id', 'name'] }
};

export function updateVerification(report, patch) {
  if (!report) throw new Error('No report available for verification update. Run analysis first.');
  const kind = String(patch?.kind || '');
  const target = TARGETS[kind];
  if (!target) throw new Error(`Unsupported verification target kind: ${kind}`);
  const id = String(patch?.id || '').trim();
  if (!id) throw new Error('verification target id is required');
  const verificationStatus = normalizeStatus(patch?.verificationStatus);
  const collection = resolveCollection(report, target.collection);
  const item = collection.find((candidate) => target.idFields.some((field) => String(candidate?.[field] || '') === id));
  if (!item) throw new Error(`Verification target not found: ${kind}:${id}`);
  item.verificationStatus = verificationStatus;
  item.verifiedBy = patch?.verifiedBy || 'local-user';
  item.verifiedAt = new Date().toISOString();
  item.verificationNote = patch?.verificationNote || patch?.note || item.verificationNote || '';
  return report;
}

function normalizeStatus(value) {
  const status = String(value || '');
  if (!ALLOWED_STATUSES.has(status)) throw new Error(`Unsupported verification status: ${status}`);
  return status;
}

function resolveCollection(report, path) {
  const collection = path.split('.').reduce((value, key) => value?.[key], report);
  if (!Array.isArray(collection)) throw new Error(`Verification collection not found: ${path}`);
  return collection;
}
