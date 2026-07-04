#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Command } from 'commander';
import open from 'open';
import { startServer } from '../server/server.js';
import { scanProject } from '../server/scanner.js';
import { buildCodeGraph } from '../server/code-graph.js';
import { buildContextPack } from '../server/context-pack.js';
import { buildRepoMap } from '../server/repo-map.js';
import { createAccessToken, isLoopbackHost, parsePort, requireNetworkFlag } from './cli-options.js';

const execFileAsync = promisify(execFile);

if (process.argv[2] === 'pack') {
  await runPack(process.argv.slice(3));
  process.exit(0);
}

const program = new Command();

program
  .name('codemap-ai')
  .description('Start codemap-ai workbench for a local project folder')
  .argument('[projectDir]', 'project folder to inspect', '.')
  .option('-p, --port <port>', 'port to listen on', '3000')
  .option('--host <host>', 'host to bind', '127.0.0.1')
  .option('--allow-network', 'allow binding to a non-loopback host')
  .option('--no-open', 'do not open browser')
  .parse(process.argv);

const opts = program.opts();
const projectDir = path.resolve(program.args[0] || '.');
let port;
let accessToken = '';
try {
  port = parsePort(opts.port);
  requireNetworkFlag(opts.host, Boolean(opts.allowNetwork));
  accessToken = isLoopbackHost(opts.host) ? '' : createAccessToken();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

try {
  const server = await startServer({ projectDir, port, host: opts.host, accessToken });
  const url = `http://${opts.host}:${server.port}${accessToken ? `?token=${accessToken}` : ''}`;
  console.log(`\ncodemap-ai is running.`);
  console.log(`Project: ${projectDir}`);
  if (accessToken) console.warn('Network access is enabled. Keep the URL token private.');
  console.log(`URL:     ${url}\n`);
  if (opts.open !== false) await open(url);
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}

async function runPack(argv) {
  const packProgram = new Command();
  packProgram
    .name('codemap-ai pack')
    .description('Build an AI-friendly context pack without starting the web UI')
    .argument('[projectDir]', 'project folder to inspect', '.')
    .option('--format <format>', 'output format: markdown or json', 'markdown')
    .option('--max-chars <chars>', 'maximum context characters', '120000')
    .option('--max-files <count>', 'maximum files to scan before building the pack')
    .option('--max-depth <depth>', 'maximum directory depth for filesystem fallback scanning')
    .option('--max-bytes-total <bytes>', 'maximum total bytes to scan')
    .option('--include <patterns...>', 'include only matching paths for the pack output')
    .option('--ignore <patterns...>', 'exclude matching paths from the pack output')
    .option('--stdin', 'read additional include paths or patterns from stdin')
    .option('--include-diffs', 'include current git diff in pack output')
    .option('--include-logs', 'include recent git log in pack output')
    .option('-o, --output <file>', 'write output to a file instead of stdout')
    .parse(argv, { from: 'user' });

  const opts = packProgram.opts();
  const format = String(opts.format || 'markdown').toLowerCase();
  if (!['markdown', 'json'].includes(format)) throw new Error('Invalid pack --format value.');
  const maxChars = parsePositiveNumber(opts.maxChars, 'pack --max-chars');
  const scanOptions = {
    maxFiles: opts.maxFiles === undefined ? undefined : parsePositiveNumber(opts.maxFiles, 'pack --max-files'),
    maxDepth: opts.maxDepth === undefined ? undefined : parsePositiveNumber(opts.maxDepth, 'pack --max-depth'),
    maxBytesTotal: opts.maxBytesTotal === undefined ? undefined : parsePositiveNumber(opts.maxBytesTotal, 'pack --max-bytes-total')
  };

  const workspace = await resolvePackWorkspace(packProgram.args[0] || '.');
  const projectDir = workspace.projectDir;
  try {
    const outputPath = opts.output ? path.resolve(opts.output) : '';
    const outputIgnore = outputPath ? relativePathIfInside(projectDir, outputPath) : '';
    const stdinInclude = opts.stdin ? await readStdinPatterns() : [];
    const scan = filterScanForPack(await scanProject(projectDir, scanOptions), {
      include: [...(opts.include || []), ...stdinInclude],
      ignore: [...(opts.ignore || []), outputIgnore].filter(Boolean)
    });
    const codeGraph = await buildCodeGraph({ root: projectDir, scan });
    const contextPack = await buildContextPack({ root: projectDir, scan, codeGraph, maxChars });
    const gitContext = await collectGitContext(projectDir, {
      includeDiffs: Boolean(opts.includeDiffs),
      includeLogs: Boolean(opts.includeLogs)
    });
    const output = format === 'json'
      ? JSON.stringify(buildPackJson({ projectDir, source: workspace.source, scan, codeGraph, contextPack, gitContext }), null, 2)
      : appendGitContextMarkdown(contextPack.markdown, gitContext);

    if (outputPath) {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, output, 'utf8');
      return;
    }
    process.stdout.write(output);
    if (!output.endsWith('\n')) process.stdout.write('\n');
  } finally {
    await workspace.cleanup?.();
  }
}

async function resolvePackWorkspace(input) {
  const source = String(input || '.');
  if (!isGitRemote(source)) return { projectDir: path.resolve(source), source: { type: 'local', value: source } };
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-remote-'));
  const projectDir = path.join(tempRoot, 'repo');
  try {
    await execFileAsync('git', ['clone', '--depth', '1', source, projectDir], { maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw new Error(`Failed to clone remote repository: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    projectDir,
    source: { type: 'git', value: source },
    cleanup: () => fs.rm(tempRoot, { recursive: true, force: true })
  };
}

function isGitRemote(value) {
  return /^(https?:\/\/|git@|ssh:\/\/|file:\/\/)/.test(String(value || ''));
}

function parsePositiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${label} value.`);
  return parsed;
}

async function readStdinPatterns() {
  if (process.stdin.isTTY) throw new Error('pack --stdin requires piped input.');
  process.stdin.setEncoding('utf8');
  let content = '';
  for await (const chunk of process.stdin) content += chunk;
  return parseStdinPatterns(content);
}

function parseStdinPatterns(content) {
  return String(content || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}

function relativePathIfInside(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return toPosixPath(relative);
}

function filterScanForPack(scan, { include = [], ignore = [] } = {}) {
  const includePatterns = normalizePathPatterns(include);
  const ignorePatterns = normalizePathPatterns(ignore);
  if (!includePatterns.length && !ignorePatterns.length) return scan;
  const files = (scan.files || []).filter((file) => {
    const included = !includePatterns.length || includePatterns.some((pattern) => pathMatchesPattern(file.path, pattern));
    const ignored = ignorePatterns.some((pattern) => pathMatchesPattern(file.path, pattern));
    return included && !ignored;
  });
  const allowedPaths = new Set(files.map((file) => file.path));
  const symbols = (scan.symbols || []).filter((symbol) => allowedPaths.has(symbol.path));
  const summary = {
    ...(scan.summary || {}),
    likelyEntrypoints: (scan.summary?.likelyEntrypoints || []).filter((item) => allowedPaths.has(item))
  };
  return {
    ...scan,
    files,
    symbols,
    keyFiles: (scan.keyFiles || []).filter((file) => allowedPaths.has(file.path)),
    totalFiles: files.length,
    totalSymbols: symbols.length,
    summary,
    tree: (scan.tree || []).filter((item) => item.type !== 'file' || allowedPaths.has(item.path)),
    repoMap: buildRepoMap({ root: scan.root, files, symbols, summary, scannedAt: scan.scannedAt })
  };
}

function normalizePathPatterns(patterns) {
  return patterns.flatMap((item) => String(item || '').split(',')).map((item) => toPosixPath(item.trim())).filter(Boolean);
}

function pathMatchesPattern(filePath, pattern) {
  const normalizedPath = toPosixPath(filePath);
  const normalizedPattern = toPosixPath(pattern);
  if (normalizedPath === normalizedPattern) return true;
  if (!/[?*]/.test(normalizedPattern)) return normalizedPath.startsWith(`${normalizedPattern.replace(/\/$/, '')}/`);
  const regex = new RegExp(`^${globToRegex(normalizedPattern)}$`);
  return regex.test(normalizedPath);
}

function globToRegex(pattern) {
  let output = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === '*' && next === '*') {
      output += '.*';
      index += 1;
    } else if (char === '*') {
      output += '[^/]*';
    } else if (char === '?') {
      output += '[^/]';
    } else {
      output += char.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
    }
  }
  return output;
}

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

async function collectGitContext(projectDir, options = {}) {
  const context = {};
  if (options.includeDiffs) context.diff = await runGitText(projectDir, ['diff', '--', '.']);
  if (options.includeLogs) context.log = await runGitText(projectDir, ['log', '--oneline', '--decorate', '-n', '20']);
  return context;
}

async function runGitText(projectDir, args) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: projectDir, maxBuffer: 2 * 1024 * 1024 });
    return stdout.trim();
  } catch (error) {
    return `Unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function appendGitContextMarkdown(markdown, gitContext) {
  if (!gitContext.diff && !gitContext.log) return markdown;
  const lines = [markdown.trimEnd(), '', '## Git Context', ''];
  if (gitContext.log) lines.push('### Recent Log', '', '```text', gitContext.log, '```', '');
  if (gitContext.diff) lines.push('### Current Diff', '', '```diff', gitContext.diff, '```', '');
  return lines.join('\n');
}

function buildPackJson({ projectDir, source = { type: 'local', value: projectDir }, scan, codeGraph, contextPack, gitContext = {} }) {
  return {
    projectDir,
    source,
    generatedAt: contextPack.generatedAt,
    scan: {
      totalFiles: scan.totalFiles,
      totalDirs: scan.totalDirs,
      totalSymbols: scan.totalSymbols,
      skippedFiles: scan.skippedFiles || [],
      summary: scan.summary,
      repoMap: scan.repoMap
    },
    codeGraph: {
      totals: codeGraph.totals,
      warnings: codeGraph.warnings
    },
    git: gitContext,
    contextPack: {
      mode: contextPack.mode,
      target: contextPack.target,
      budget: contextPack.budget,
      files: contextPack.files,
      skippedFiles: contextPack.skippedFiles || [],
      chunks: contextPack.chunks,
      graphContext: {
        relatedPaths: contextPack.graphContext?.relatedPaths || [],
        warnings: contextPack.graphContext?.warnings || []
      }
    }
  };
}
