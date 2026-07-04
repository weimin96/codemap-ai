import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { exists } from './fs-utils.js';

const REPORT_DIR = path.join(os.homedir(), '.project-fast-onboarding', 'reports');

export async function readProjectReport(projectDir) {
  const filePath = reportFilePath(projectDir);
  if (!(await exists(filePath))) return null;
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`分析结果读取失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || parsed.projectDir !== projectDir || !parsed.report) {
    throw new Error('分析结果文件内容无效');
  }
  return parsed.report;
}

export async function writeProjectReport(projectDir, report) {
  if (!report) throw new Error('分析结果不能为空');
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const payload = {
    projectDir,
    savedAt: new Date().toISOString(),
    report
  };
  await fs.writeFile(reportFilePath(projectDir), JSON.stringify(payload, null, 2), { mode: 0o600 });
  return report;
}

export async function deleteProjectReport(projectDir) {
  const filePath = reportFilePath(projectDir);
  if (!(await exists(filePath))) return;
  await fs.unlink(filePath);
}

function reportFilePath(projectDir) {
  const key = crypto.createHash('sha256').update(path.resolve(projectDir)).digest('hex');
  return path.join(REPORT_DIR, `${key}.json`);
}
