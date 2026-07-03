import { Bot, CircleAlert, FileCode2, Loader2, Play } from 'lucide-react';
import { ActionItem } from '@/components/common/ActionItem';
import { ContextSummary } from '@/components/WorkbenchPanels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { CoreFlow, FilePayload, Report, SymbolInfo } from '@/types';

interface RiskItem {
  title?: string;
}

const QUICK_QUESTIONS = ['解释当前文件主流程', '找这段代码的风险', '追踪数据读写', '推荐断点验证', '改这里影响哪里', '下一步看什么'];

export function AskPanel({
  report,
  currentFile,
  currentSymbol,
  activeFlow,
  activeRisk,
  selection,
  question,
  answer,
  loading,
  onQuestionChange,
  onAsk,
  onExportContextPack,
  onOpenFile
}: {
  report: Report | null;
  currentFile: FilePayload | null;
  currentSymbol: SymbolInfo | null;
  activeFlow: CoreFlow | null;
  activeRisk: RiskItem | null;
  selection: { startLine: number; endLine: number } | null;
  question: string;
  answer: string;
  loading: string;
  onQuestionChange: (question: string) => void;
  onAsk: (question?: string) => void;
  onExportContextPack: () => void;
  onOpenFile: (path: string) => void;
}) {
  return <aside className="overflow-y-auto space-y-3">
    <QuestionCard
      currentFile={currentFile}
      currentSymbol={currentSymbol}
      activeFlow={activeFlow}
      activeRisk={activeRisk}
      selection={selection}
      question={question}
      loading={loading}
      onQuestionChange={onQuestionChange}
      onAsk={onAsk}
    />
    <ContextFilesCard report={report} onExportContextPack={onExportContextPack} onOpenFile={onOpenFile} />
    <AnswerCard answer={answer} loading={loading} />
    <ReadingPlanCard report={report} onOpenFile={onOpenFile} />
  </aside>;
}

function QuestionCard({ currentFile, currentSymbol, activeFlow, activeRisk, selection, question, loading, onQuestionChange, onAsk }: {
  currentFile: FilePayload | null;
  currentSymbol: SymbolInfo | null;
  activeFlow: CoreFlow | null;
  activeRisk: RiskItem | null;
  selection: { startLine: number; endLine: number } | null;
  question: string;
  loading: string;
  onQuestionChange: (question: string) => void;
  onAsk: (question?: string) => void;
}) {
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm"><Bot size={16} />上下文追问</CardTitle>
      <CardDescription>追问会自动绑定当前文件、选中行、链路和风险。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <ContextSummary currentFile={currentFile} currentSymbol={currentSymbol} activeFlow={activeFlow} activeRisk={activeRisk} selection={selection} />
      <div className="grid grid-cols-2 gap-2">
        {QUICK_QUESTIONS.map((quickQuestion) => <Button key={quickQuestion} size="sm" variant="outline" onClick={() => onAsk(quickQuestion)}>{quickQuestion}</Button>)}
      </div>
      <Textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} placeholder="围绕当前文件/链路追问，例如：这个状态在哪里被修改？" />
      <Button className="w-full" onClick={() => onAsk()} disabled={!!loading}>{loading === 'ask' ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}追问</Button>
    </CardContent>
  </Card>;
}

function ContextFilesCard({ report, onExportContextPack, onOpenFile }: { report: Report | null; onExportContextPack: () => void; onOpenFile: (path: string) => void }) {
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm"><FileCode2 size={16} />分析上下文</CardTitle>
      <CardDescription>AI 分析会优先使用 Repo Map 和以下上下文文件。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      <Button size="sm" variant="outline" onClick={onExportContextPack}>导出 project-context.md</Button>
      <div className="space-y-1 max-h-56 overflow-auto">
        {(report?.contextFiles || []).slice(0, 24).map((file) => (
          <ActionItem key={file.path} onClick={() => onOpenFile(file.path)}>
            <div className="truncate font-mono">{file.path}</div>
            <div className="text-[10px] text-muted-foreground">{file.priority} · score {file.score} · {file.charCount} chars{file.truncated ? ' · truncated' : ''}</div>
          </ActionItem>
        ))}
        {!report?.contextFiles?.length && <div className="text-xs text-muted-foreground">开始 AI 分析后显示本次使用的上下文文件。</div>}
      </div>
    </CardContent>
  </Card>;
}

function AnswerCard({ answer, loading }: { answer: string; loading: string }) {
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CircleAlert size={16} />AI 回答</CardTitle></CardHeader>
    <CardContent>
      <div className="min-h-72 whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-sm leading-6 text-slate-700">{loading && loading !== 'ask' ? `正在处理：${loading}` : answer || '暂无回答。先选择文件或链路，然后提问。'}</div>
    </CardContent>
  </Card>;
}

function ReadingPlanCard({ report, onOpenFile }: { report: Report | null; onOpenFile: (path: string) => void }) {
  return <Card>
    <CardHeader><CardTitle className="text-sm">阅读路线</CardTitle></CardHeader>
    <CardContent className="space-y-2">
      {report?.readingPlan?.map((plan, index) => <div key={index} className="rounded-md border p-2 text-sm"><div className="font-medium">{plan.timebox} · {plan.goal}</div><div className="text-xs text-muted-foreground mt-1">{plan.output}</div>{plan.files?.slice(0, 4).map((file) => <Button key={file} type="button" variant="ghost" size="sm" onClick={() => onOpenFile(file)} className="h-auto justify-start truncate px-0 py-0 text-xs text-blue-700 hover:bg-transparent hover:underline">{file}</Button>)}</div>)}
    </CardContent>
  </Card>;
}
