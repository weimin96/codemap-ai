import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { AiConfig } from '@/types';

const providerDefaults: Record<string, AiConfig> = {
  auto: {
    provider: 'auto',
    baseURL: '',
    model: 'auto',
    apiKey: '',
    timeoutMs: 60000
  },
  'openai-compatible': {
    provider: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    apiKey: '',
    timeoutMs: 60000
  },
  openai: {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    apiKey: '',
    timeoutMs: 60000
  },
  deepseek: {
    provider: 'deepseek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiKey: '',
    timeoutMs: 60000
  },
  kimi: {
    provider: 'kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2.7-code',
    apiKey: '',
    timeoutMs: 60000
  },
  zhipu: {
    provider: 'zhipu',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.1',
    apiKey: '',
    timeoutMs: 60000
  },
  siliconflow: {
    provider: 'siliconflow',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    apiKey: '',
    timeoutMs: 60000
  },
  openrouter: {
    provider: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-sonnet-4.5',
    apiKey: '',
    timeoutMs: 60000
  },
  ollama: {
    provider: 'ollama',
    baseURL: 'http://127.0.0.1:11434/api',
    model: 'qwen2.5-coder:7b',
    apiKey: '',
    timeoutMs: 60000
  },
  custom: {
    provider: 'custom',
    baseURL: '',
    model: '',
    apiKey: '',
    timeoutMs: 60000
  }
};

const providerModels: Record<string, string[]> = {
  auto: ['auto'],
  'openai-compatible': ['gpt-4.1-mini'],
  openai: ['gpt-4.1-mini'],
  deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  kimi: ['kimi-k2.7-code'],
  zhipu: ['glm-5.1'],
  siliconflow: ['Qwen/Qwen3-Coder-480B-A35B-Instruct'],
  openrouter: ['anthropic/claude-sonnet-4.5'],
  ollama: ['qwen2.5-coder:7b']
};

export function SettingsPage({
  open,
  config,
  loading,
  onOpenChange,
  onConfigChange,
  onSaveConfig
}: {
  open: boolean;
  config: AiConfig;
  loading: string;
  onOpenChange: (open: boolean) => void;
  onConfigChange: (config: AiConfig) => void;
  onSaveConfig: () => void;
}) {
  const [testStatus, setTestStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function updateConfig(nextConfig: AiConfig) {
    setTestStatus(null);
    onConfigChange(nextConfig);
  }

  async function testConnection() {
    const validationError = validateConnectionConfig(config);
    if (validationError) {
      setTestStatus({ ok: false, text: validationError });
      return;
    }
    setTesting(true);
    setTestStatus(null);
    try {
      const response = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      const text = await response.text();
      const data = parseJsonResponse(text);
      if (!response.ok || data.error) throw new Error(data.error || '连接测试失败');
      setTestStatus({ ok: true, text: `连接成功，已验证 ${data.endpoint || '当前配置'}。` });
    } catch (error) {
      setTestStatus({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader title="AI 设置" description="配置模型提供商和连接信息。" onClose={() => onOpenChange(false)} />
      <DialogBody className="grid gap-4">
        <Field label="提供商">
          <Select value={config.provider} onChange={(event) => updateConfig(providerConfig(config, event.target.value))}>
            <option value="auto">Auto fallback</option>
            <option value="openai-compatible">OpenAI Compatible</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="kimi">Kimi</option>
            <option value="zhipu">智谱 GLM</option>
            <option value="siliconflow">SiliconFlow</option>
            <option value="openrouter">OpenRouter</option>
            <option value="ollama">Ollama</option>
            <option value="custom">自定义提供商</option>
          </Select>
        </Field>
        <Field label="Base URL">
          <Input value={config.baseURL} onChange={(event) => updateConfig({ ...config, baseURL: event.target.value })} />
        </Field>
        <Field label="Model">
          {config.provider === 'custom'
            ? <Input name="codemap-ai-model" value={config.model} autoComplete="off" onChange={(event) => onConfigChange({ ...config, model: event.target.value })} />
            : <Select name="codemap-ai-model" value={config.model} autoComplete="off" onChange={(event) => onConfigChange({ ...config, model: event.target.value })}>
              {modelOptions(config.provider, config.model).map((model) => <option key={model} value={model}>{model}</option>)}
            </Select>}
        </Field>
        <Field label="API Key">
          <Input name="codemap-ai-api-key" value={config.apiKey} type="text" autoComplete="off" spellCheck={false} className="[-webkit-text-security:disc]" onChange={(event) => updateConfig({ ...config, apiKey: event.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="请求超时">
            <Input value={String(config.timeoutMs || 60000)} type="number" min="1000" max="600000" step="1000" onChange={(event) => updateConfig({ ...config, timeoutMs: Number(event.target.value) })} />
          </Field>
          <Field label="Temperature">
            <Input defaultValue="0.2" type="number" min="0" max="2" step="0.1" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Token 预算">
            <Input defaultValue="4096" type="number" min="1" />
          </Field>
        </div>
        {testStatus && <div className={`rounded-md border px-3 py-2 text-sm ${testStatus.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{testStatus.text}</div>}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={testConnection} disabled={testing}>
          <RefreshCw size={15} />
          {testing ? '测试中' : '测试连接'}
        </Button>
        <Button type="button" variant="outline" onClick={() => updateConfig(providerDefaults['openai-compatible'])}>恢复默认</Button>
        <Button type="button" onClick={onSaveConfig} disabled={!!loading}>保存配置</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function providerConfig(config: AiConfig, provider: string): AiConfig {
  const defaults = providerDefaults[provider] || providerDefaults['openai-compatible'];
  if (provider === 'auto') {
    return { provider, baseURL: '', model: '', apiKey: config.apiKey === '********' ? '' : config.apiKey, timeoutMs: config.timeoutMs || 60000 };
  }
  if (provider === 'custom') {
    return { provider, baseURL: '', model: '', apiKey: config.apiKey === '********' ? '' : config.apiKey, timeoutMs: config.timeoutMs || 60000 };
  }
  return { ...defaults, apiKey: config.apiKey === '********' ? '' : config.apiKey, timeoutMs: config.timeoutMs || defaults.timeoutMs };
}

function modelOptions(provider: string, currentModel: string) {
  const options = providerModels[provider] || providerModels['openai-compatible'];
  return currentModel && !options.includes(currentModel) ? [currentModel, ...options] : options;
}

function validateConnectionConfig(config: AiConfig) {
  if (config.provider === 'auto') return '';
  if (!config.baseURL.trim()) return '请先填写 Base URL。';
  if (!config.model.trim()) return '请先选择或填写 Model。';
  if (config.provider !== 'ollama' && !config.apiKey.trim() && config.apiKey !== '********') return '请先填写 API Key。';
  if (!isValidTimeout(config.timeoutMs)) return '请求超时需在 1000 到 600000 毫秒之间。';
  return '';
}

function isValidTimeout(timeoutMs: AiConfig['timeoutMs']) {
  const value = Number(timeoutMs);
  return Number.isInteger(value) && value >= 1000 && value <= 600000;
}

function parseJsonResponse(text: string) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 180) || '连接测试返回了无效响应');
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid grid-cols-[112px_1fr] items-center gap-4 text-sm">
    <span className="text-slate-700">{label}</span>
    {children}
  </label>;
}
