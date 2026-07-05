const SENSITIVE_PATH_PATTERN = /(^|\/)\.env($|[./])|(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$|\.(pem|p12|pfx|key)$/i;

const SECRET_PATTERNS = [
  { kind: 'private_key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { kind: 'aws_access_key_id', pattern: /\bA(?:KIA|SIA)[A-Z0-9]{16}\b/g },
  { kind: 'github_token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g },
  { kind: 'slack_token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { kind: 'jwt', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { kind: 'credential_assignment', pattern: /((?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?)[A-Za-z0-9_./+=-]{16,}/gi }
];

export function redactAiInput({ question = '', context = {} } = {}) {
  const warnings = [];
  const redactedQuestion = redactSensitiveText(String(question), warnings);
  const redactedContext = redactAiContext(context, warnings);
  if (warnings.length && redactedContext && typeof redactedContext === 'object' && !Array.isArray(redactedContext)) {
    redactedContext.redactionWarnings = uniqueWarnings([...(Array.isArray(redactedContext.redactionWarnings) ? redactedContext.redactionWarnings : []), ...warnings]);
  }
  return { question: redactedQuestion, context: redactedContext, warnings: uniqueWarnings(warnings) };
}

export function redactAiContext(value, warnings = [], keyPath = []) {
  if (Array.isArray(value)) return value.map((item, index) => redactAiContext(item, warnings, [...keyPath, String(index)]));
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = redactAiContext(item, warnings, [...keyPath, key]);
    }
    if (typeof next.path === 'string' && SENSITIVE_PATH_PATTERN.test(next.path) && typeof next.content === 'string') {
      next.content = '[REDACTED:sensitive_path]';
      next.truncated = true;
      warnings.push(`${keyPath.join('.') || 'context'}: sensitive_path`);
    }
    if (typeof next.path === 'string' && SENSITIVE_PATH_PATTERN.test(next.path) && typeof next.code === 'string') {
      next.code = '[REDACTED:sensitive_path]';
      warnings.push(`${keyPath.join('.') || 'context'}: sensitive_path`);
    }
    return next;
  }
  if (typeof value === 'string') return redactSensitiveText(value, warnings, keyPath.join('.') || 'text');
  return value;
}

export function redactSensitiveText(value, warnings = [], label = 'text') {
  let redacted = value;
  for (const item of SECRET_PATTERNS) {
    let matched = false;
    redacted = redacted.replace(item.pattern, (...args) => {
      matched = true;
      if (item.kind === 'credential_assignment') return `${args[1]}[REDACTED:${item.kind}]`;
      return `[REDACTED:${item.kind}]`;
    });
    if (matched) warnings.push(`${label}: ${item.kind}`);
  }
  return redacted;
}

export function isSensitivePath(path) {
  return SENSITIVE_PATH_PATTERN.test(String(path || ''));
}

function uniqueWarnings(warnings) {
  return Array.from(new Set(warnings.filter(Boolean)));
}
