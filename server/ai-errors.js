export const AI_ERROR_CODES = {
  TIMEOUT: 'AI_REQUEST_TIMEOUT',
  CANCELLED: 'AI_REQUEST_CANCELLED',
  RATE_LIMIT: 'AI_PROVIDER_RATE_LIMIT',
  AUTH_FAILED: 'AI_PROVIDER_AUTH_FAILED',
  BAD_JSON: 'AI_PROVIDER_BAD_JSON',
  SCHEMA_INVALID: 'AI_SCHEMA_INVALID',
  PROVIDER_ERROR: 'AI_PROVIDER_ERROR'
};

export class AiError extends Error {
  constructor({ code, message, retryable = false, status = 0, cause = null }) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.cause = cause;
  }
}

export function classifyAiError(error) {
  if (error instanceof AiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const status = Number(error?.status || error?.response?.status || 0);
  const lower = message.toLowerCase();

  if (lower.includes('timed out')) {
    return new AiError({ code: AI_ERROR_CODES.TIMEOUT, message, retryable: true, status, cause: error });
  }
  if (lower.includes('cancelled') || lower.includes('canceled') || error?.name === 'AbortError') {
    return new AiError({ code: AI_ERROR_CODES.CANCELLED, message, retryable: false, status, cause: error });
  }
  if (status === 401 || status === 403 || lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return new AiError({ code: AI_ERROR_CODES.AUTH_FAILED, message, retryable: false, status: status || statusFromMessage(message), cause: error });
  }
  if (status === 429 || lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return new AiError({ code: AI_ERROR_CODES.RATE_LIMIT, message, retryable: true, status: status || 429, cause: error });
  }
  if (lower.includes('not valid json') || lower.includes('json parse')) {
    return new AiError({ code: AI_ERROR_CODES.BAD_JSON, message, retryable: false, status, cause: error });
  }
  if (lower.includes('schema') || lower.includes('type validation') || lower.includes('no object generated')) {
    return new AiError({ code: AI_ERROR_CODES.SCHEMA_INVALID, message, retryable: false, status, cause: error });
  }
  return new AiError({ code: AI_ERROR_CODES.PROVIDER_ERROR, message, retryable: true, status, cause: error });
}

export function formatAiError(error) {
  const classified = classifyAiError(error);
  return `${classified.code}: ${classified.message}`;
}

function statusFromMessage(message) {
  const match = String(message).match(/\b(401|403|429|5\d\d)\b/);
  return match ? Number(match[1]) : 0;
}
