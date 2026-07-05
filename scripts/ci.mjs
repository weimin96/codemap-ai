import { spawn } from 'node:child_process';

const packageManager = process.env.npm_execpath;
const runner = packageManager ? [process.execPath, [packageManager]] : [process.platform === 'win32' ? 'npm.cmd' : 'npm', []];

const commands = [
  scriptCommand('typecheck'),
  scriptCommand('test'),
  scriptCommand('build')
];

if (process.argv.includes('--e2e')) commands.push(scriptCommand('test:e2e'));
if (process.argv.includes('--pack')) commands.push(scriptCommand('release:dry-run'));

function scriptCommand(script) {
  return [runner[0], [...runner[1], 'run', script]];
}

for (const [command, args] of commands) {
  await run(command, args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const suffix = signal ? `with signal ${signal}` : `with exit code ${code}`;
      reject(new Error(`${command} ${args.join(' ')} failed ${suffix}`));
    });
  });
}
