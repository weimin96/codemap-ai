export function languageForMonaco(file?: string) {
  if (!file) return 'plaintext';
  if (/\.tsx?$/.test(file)) return 'typescript';
  if (/\.jsx?$/.test(file)) return 'javascript';
  if (/\.json$/.test(file)) return 'json';
  if (/\.mdx?$/.test(file)) return 'markdown';
  if (/\.ya?ml$/.test(file)) return 'yaml';
  if (/\.css$/.test(file)) return 'css';
  if (/\.html$/.test(file)) return 'html';
  if (/\.py$/.test(file)) return 'python';
  if (/\.go$/.test(file)) return 'go';
  if (/\.rs$/.test(file)) return 'rust';
  if (/\.java$/.test(file)) return 'java';
  if (/\.sql$/.test(file)) return 'sql';
  return 'plaintext';
}
