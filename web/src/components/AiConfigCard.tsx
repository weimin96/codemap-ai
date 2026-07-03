import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { AiConfig } from '@/types';

export function AiConfigCard({
  config,
  loading,
  onChange,
  onSave
}: {
  config: AiConfig;
  loading: string;
  onChange: (config: AiConfig) => void;
  onSave: () => void;
}) {
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm"><KeyRound size={16} />AI 配置</CardTitle>
      <CardDescription>使用 AI SDK provider 调用模型。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      <Select value={config.provider} onChange={(event) => onChange({ ...config, provider: event.target.value })}>
        <option value="openai-compatible">OpenAI Compatible</option>
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
      </Select>
      <Input value={config.baseURL} onChange={(event) => onChange({ ...config, baseURL: event.target.value })} placeholder="Base URL" />
      <Input value={config.model} onChange={(event) => onChange({ ...config, model: event.target.value })} placeholder="Model" />
      <Input value={config.apiKey} onChange={(event) => onChange({ ...config, apiKey: event.target.value })} placeholder="API Key" type="password" />
      <Button size="sm" variant="secondary" onClick={onSave} disabled={!!loading}>保存配置</Button>
    </CardContent>
  </Card>;
}
