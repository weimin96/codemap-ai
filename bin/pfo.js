#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { Command } from 'commander';
import open from 'open';
import { startServer } from '../server/server.js';
import { createAccessToken, isLoopbackHost, parsePort, requireNetworkFlag } from './cli-options.js';

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
