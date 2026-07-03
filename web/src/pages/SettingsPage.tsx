import type { ReactNode } from 'react';
import { BrainCircuit, CheckCircle2, Cloud, Eye, Info, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { ActionItem } from '@/components/common/ActionItem';
import { PageHero, SectionTitle } from '@/components/PageBlocks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AiConfig } from '@/types';

export function SettingsPage({ config, loading, onConfigChange, onSaveConfig }: { config: AiConfig; loading: string; onConfigChange: (config: AiConfig) => void; onSaveConfig: () => void }) {
  return <div className="space-y-4">
    <PageHero icon={<BrainCircuit size={30} />} title="AI 设置" description="配置本地或云端模型提供商，用于项目分析与上下文问答。选择合适的模型与偏好设置，可获得更精准的分析结果。" />

    <div className="grid grid-cols-[1fr_1.25fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <StepTitle step="1" title="提供商选择" description="选择用于分析与问答的模型提供商。" />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <ProviderCard active={config.provider !== 'ollama'} title="OpenAI Compatible" description="兼容 OpenAI 接口的模型服务，如 OpenAI、Azure OpenAI、智谱、火山引擎等。" onClick={() => onConfigChange({ ...config, provider: 'openai-compatible' })} />
            <ProviderCard active={config.provider === 'ollama'} title="Ollama" description="在本地运行大模型，数据不离开您的设备，隐私更可控。" onClick={() => onConfigChange({ ...config, provider: 'ollama', baseURL: 'http://127.0.0.1:11434/api' })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <StepTitle step="2" title="连接配置" description="填写所选提供商的连接信息。" />
          <div className="mt-5 grid gap-4">
            <Field label="Base URL"><Input value={config.baseURL} onChange={(event) => onConfigChange({ ...config, baseURL: event.target.value })} /></Field>
            <Field label="Model"><Input value={config.model} onChange={(event) => onConfigChange({ ...config, model: event.target.value })} /></Field>
            <Field label="API Key"><div className="flex gap-2"><Input value={config.apiKey} type="password" onChange={(event) => onConfigChange({ ...config, apiKey: event.target.value })} /><Button variant="outline" size="sm"><Eye size={15} />验证密钥</Button></div></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Temperature"><Input defaultValue="0.2" type="number" /></Field>
              <Field label="Token 预算"><Input defaultValue="4096" type="number" /></Field>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-3 gap-4">
      <PreferenceCard title="分析偏好" icon={<SlidersHorizontal size={17} />} items={['本地优先', '发送前显示上下文摘要', '启用增量分析', '忽略敏感文件']} />
      <PreferenceCard title="隐私与安全" icon={<ShieldCheck size={17} />} items={['不将我的数据用于模型训练', '启用请求日志脱敏', 'API Key 本地加密保存']} />
      <Card>
        <CardContent className="p-5">
          <StepTitle step="5" title="测试连接" description="验证当前配置是否可用。" />
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 rounded-full bg-slate-300" />尚未测试连接</div>
            <Button variant="outline"><RefreshCw size={15} />测试连接</Button>
          </div>
          <div className="mt-5 rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-600">默认忽略文件：`.env`、`node_modules/`、`dist/`、`.git/`、`*.log`、`*.lock`。</div>
        </CardContent>
      </Card>
    </div>

    <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <div className="flex items-center gap-2"><Info size={16} />云端模型提供商可能会接收您选择发送的代码或上下文，请确认组织安全与合规要求。</div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => onConfigChange({ provider: 'openai-compatible', baseURL: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', apiKey: '' })}>恢复默认</Button><Button onClick={onSaveConfig} disabled={!!loading}>保存配置</Button></div>
    </div>
  </div>;
}

function StepTitle({ step, title, description }: { step: string; title: string; description: string }) {
  return <div><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{step}</span><h2 className="font-semibold text-slate-950">{title}</h2></div><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>;
}

function ProviderCard({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return <ActionItem onClick={onClick} className={`rounded-xl p-5 text-sm ${active ? 'border-blue-400 bg-blue-50/40' : 'bg-white hover:border-blue-200'}`}>
    <div className="mb-4 flex items-center justify-between"><Cloud size={28} className="text-blue-600" />{active ? <CheckCircle2 size={18} className="text-blue-600" /> : <span className="h-4 w-4 rounded-full border" />}</div>
    <div className="font-semibold text-slate-950">{title} {active && <Badge className="ml-2">推荐</Badge>}</div>
    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
  </ActionItem>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid grid-cols-[120px_1fr] items-center gap-4 text-sm"><span className="text-slate-700">{label}</span>{children}</label>;
}

function PreferenceCard({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return <Card><CardContent className="p-5"><div className="mb-4 flex items-center gap-2 font-semibold text-slate-950">{icon}{title}</div><div className="space-y-3">{items.map((item, index) => <label key={item} className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" defaultChecked={index < 3} className="mt-1" /> <span>{item}</span></label>)}</div></CardContent></Card>;
}
