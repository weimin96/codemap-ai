const MAX_SYMBOLS_PER_FILE = 120;
const MAX_SYMBOL_BYTES = 220_000;

const BRACE_LANGUAGES = new Set(['javascript', 'typescript', 'go', 'java']);
const SYMBOL_LANGUAGES = new Set([...BRACE_LANGUAGES, 'python']);

const CONTROL_WORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'throw', 'new', 'do', 'else',
  'try', 'finally', 'await', 'async'
]);

export function canExtractSymbols(language) {
  return SYMBOL_LANGUAGES.has(language);
}

export function extractSymbols({ path, language, content }) {
  if (!canExtractSymbols(language) || !content || Buffer.byteLength(content, 'utf8') > MAX_SYMBOL_BYTES) return [];
  const lines = content.split(/\r?\n/);
  const candidates = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const startLine = index + 1;
    const symbol = symbolFromLine({ line, startLine, language, lines });
    if (symbol) candidates.push(symbol);
    if (candidates.length >= MAX_SYMBOLS_PER_FILE) break;
  }

  return dedupeSymbols(candidates).map((symbol) => ({
    id: `${path}:${symbol.startLine}:${symbol.kind}:${symbol.name}`,
    ...symbol,
    path
  }));
}

function symbolFromLine({ line, startLine, language, lines }) {
  const trimmed = line.trim();
  if (!trimmed || isComment(trimmed, language)) return null;

  if (language === 'python') return pythonSymbol({ line, startLine, lines });
  if (language === 'go') return goSymbol({ line, startLine, lines });
  if (language === 'java') return javaSymbol({ line, startLine, lines });
  if (language === 'javascript' || language === 'typescript') return javascriptSymbol({ line, startLine, lines });
  return null;
}

function javascriptSymbol({ line, startLine, lines }) {
  const trimmed = line.trim();
  const declarations = [
    { kind: 'class', match: trimmed.match(/^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/) },
    { kind: 'interface', match: trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/) },
    { kind: 'type', match: trimmed.match(/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/) },
    { kind: 'enum', match: trimmed.match(/^(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/) },
    { kind: 'function', match: trimmed.match(/^export\s+default\s+(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/) },
    { kind: 'function', match: trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*([A-Za-z_$][\w$]*)?\s*\(/) },
    { kind: 'function', match: trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/) },
    { kind: 'function', match: trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?function\s*\(/) },
    { kind: 'constant', match: trimmed.match(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/) },
    { kind: 'constant', match: trimmed.match(/^(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=/) }
  ];

  for (const declaration of declarations) {
    if (!declaration.match) continue;
    const name = declaration.match[1] || 'default';
    return buildSymbol({ name, kind: declaration.kind, line, startLine, lines, language: 'javascript' });
  }

  const methodPatterns = [
    trimmed.match(/^(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^=]+)?\s*\{?$/),
    trimmed.match(/^(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+)*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/),
    trimmed.match(/^([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/),
    trimmed.match(/^([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\s*\(/)
  ];
  const methodMatch = methodPatterns.find(Boolean);
  if (methodMatch && !CONTROL_WORDS.has(methodMatch[1])) {
    return buildSymbol({ name: methodMatch[1], kind: 'method', line, startLine, lines, language: 'javascript' });
  }

  return null;
}

function pythonSymbol({ line, startLine, lines }) {
  const trimmed = line.trim();
  const classMatch = trimmed.match(/^class\s+([A-Za-z_][\w]*)\s*(?:\([^)]*\))?:/);
  if (classMatch) return buildSymbol({ name: classMatch[1], kind: 'class', line, startLine, lines, language: 'python' });

  const functionMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/);
  if (functionMatch) return buildSymbol({ name: functionMatch[1], kind: 'function', line, startLine, lines, language: 'python' });

  const constantMatch = trimmed.match(/^([A-Z][A-Z0-9_]*)\s*=/);
  if (constantMatch) return buildSymbol({ name: constantMatch[1], kind: 'constant', line, startLine, lines, language: 'python' });

  return null;
}

function goSymbol({ line, startLine, lines }) {
  const trimmed = line.trim();
  const methodMatch = trimmed.match(/^func\s*\([^)]*\)\s*([A-Za-z_][\w]*)\s*\(/);
  if (methodMatch) return buildSymbol({ name: methodMatch[1], kind: 'method', line, startLine, lines, language: 'go' });

  const functionMatch = trimmed.match(/^func\s+([A-Za-z_][\w]*)\s*\(/);
  if (functionMatch) return buildSymbol({ name: functionMatch[1], kind: 'function', line, startLine, lines, language: 'go' });

  const typeMatch = trimmed.match(/^type\s+([A-Za-z_][\w]*)\s+(?:struct|interface)\b/);
  if (typeMatch) return buildSymbol({ name: typeMatch[1], kind: 'type', line, startLine, lines, language: 'go' });

  const constantMatch = trimmed.match(/^(?:const|var)\s+([A-Za-z_][\w]*)\b/);
  if (constantMatch) return buildSymbol({ name: constantMatch[1], kind: 'constant', line, startLine, lines, language: 'go' });

  return null;
}

function javaSymbol({ line, startLine, lines }) {
  const trimmed = line.trim();
  const classMatch = trimmed.match(/^(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+)*class\s+([A-Za-z_][\w]*)/);
  if (classMatch) return buildSymbol({ name: classMatch[1], kind: 'class', line, startLine, lines, language: 'java' });

  const interfaceMatch = trimmed.match(/^(?:public\s+|private\s+|protected\s+)*interface\s+([A-Za-z_][\w]*)/);
  if (interfaceMatch) return buildSymbol({ name: interfaceMatch[1], kind: 'interface', line, startLine, lines, language: 'java' });

  const constantMatch = trimmed.match(/^(?:public\s+|private\s+|protected\s+|static\s+|final\s+)*[A-Za-z_<>, ?\[\]]+\s+([A-Z][A-Z0-9_]*)\s*=/);
  if (constantMatch) return buildSymbol({ name: constantMatch[1], kind: 'constant', line, startLine, lines, language: 'java' });

  const methodMatch = trimmed.match(/^(?:public\s+|private\s+|protected\s+|static\s+|final\s+|abstract\s+|synchronized\s+)*[A-Za-z_<>, ?\[\]]+\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*(?:throws\s+[A-Za-z_,\s]+)?\s*\{?$/);
  if (methodMatch && !CONTROL_WORDS.has(methodMatch[1])) {
    return buildSymbol({ name: methodMatch[1], kind: 'method', line, startLine, lines, language: 'java' });
  }

  return null;
}

function buildSymbol({ name, kind, line, startLine, lines, language }) {
  const endLine = kind === 'constant'
    ? startLine
    : language === 'python'
      ? findPythonEndLine(lines, startLine)
      : findBraceEndLine(lines, startLine);
  return {
    name,
    kind,
    startLine,
    endLine,
    signature: line.trim()
  };
}

function findBraceEndLine(lines, startLine) {
  let depth = 0;
  let opened = false;
  let quote = null;
  let escaped = false;
  for (let index = startLine - 1; index < lines.length; index += 1) {
    const code = lines[index];
    for (let cursor = 0; cursor < code.length; cursor += 1) {
      const char = code[cursor];
      const next = code[cursor + 1];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '/' && next === '/') break;
      if (char === '/' && isRegexStart(code, cursor)) {
        quote = '/';
        continue;
      }
      if (char === '\'' || char === '"' || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{') { depth += 1; opened = true; }
      if (char === '}') depth -= 1;
    }
    if (opened && depth <= 0) return index + 1;
    if (!opened && index > startLine + 6) return startLine;
  }
  return startLine;
}

function isRegexStart(line, cursor) {
  const previous = line.slice(0, cursor).trimEnd().at(-1);
  return !previous || '([{=,:;!?'.includes(previous);
}

function findPythonEndLine(lines, startLine) {
  const first = lines[startLine - 1];
  const indent = first.match(/^\s*/)?.[0].length || 0;
  for (let index = startLine; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const currentIndent = line.match(/^\s*/)?.[0].length || 0;
    if (currentIndent <= indent) return index;
  }
  return lines.length;
}

function isComment(trimmed, language) {
  if (language === 'python') return trimmed.startsWith('#');
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

function dedupeSymbols(symbols) {
  const seen = new Set();
  const unique = [];
  for (const symbol of symbols) {
    const key = `${symbol.kind}:${symbol.name}:${symbol.startLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(symbol);
  }
  return unique;
}
