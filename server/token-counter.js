const DEFAULT_CHARS_PER_TOKEN = 3;

let tiktokenModulePromise = null;

export function estimateTokenCount(text) {
  return Math.ceil(String(text || '').length / DEFAULT_CHARS_PER_TOKEN);
}

export async function countTokens(text, options = {}) {
  const provider = String(options.provider || process.env.CODEMAP_AI_TOKENIZER_PROVIDER || 'openai').toLowerCase();
  const model = options.model || process.env.CODEMAP_AI_TOKENIZER_MODEL || 'gpt-4o-mini';
  if (provider === 'openai') {
    const exact = await countOpenAiTokens(text, model);
    if (exact) return exact;
  }
  return {
    tokens: estimateTokenCount(text),
    provider,
    model,
    tokenizer: 'char-estimate',
    precision: 'estimated',
    warnings: [`Exact tokenizer is unavailable for provider: ${provider}`]
  };
}

async function countOpenAiTokens(text, model) {
  const tiktoken = await loadTiktoken();
  if (!tiktoken) return null;
  try {
    const encoding = tiktoken.encodingForModel?.(model) || tiktoken.getEncoding?.('cl100k_base');
    if (!encoding?.encode) return null;
    return {
      tokens: encoding.encode(String(text || '')).length,
      provider: 'openai',
      model,
      tokenizer: 'js-tiktoken',
      precision: 'exact',
      warnings: []
    };
  } catch (error) {
    return {
      tokens: estimateTokenCount(text),
      provider: 'openai',
      model,
      tokenizer: 'char-estimate',
      precision: 'estimated',
      warnings: [`OpenAI tokenizer failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

async function loadTiktoken() {
  if (!tiktokenModulePromise) {
    tiktokenModulePromise = import('js-tiktoken').catch(() => null);
  }
  return await tiktokenModulePromise;
}
