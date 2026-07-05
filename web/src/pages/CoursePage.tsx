import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Download, FileCode2, GraduationCap, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, SectionTitle } from '@/components/PageBlocks';
import type { CodeTranslationBlock, CourseMaterials, CourseModule, ModuleBrief, Report, ScenarioQuiz } from '@/types';

export function CoursePage({ report, onExportCourse }: { report: Report | null; onExportCourse: () => void }) {
  const [materials, setMaterials] = useState<CourseMaterials | null>(null);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!report || report.analysisQuality?.partial) {
      setMaterials(null);
      setActiveId('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch('/api/course-materials')
      .then(async (response) => {
        const data = await response.json().catch(() => null) as CourseMaterials & { error?: string } | null;
        if (!response.ok || data?.error) throw new Error(data?.error || `课程材料生成失败：${response.status}`);
        return data as CourseMaterials;
      })
      .then((data) => {
        if (cancelled) return;
        setMaterials(data);
        setActiveId(data.courseModules[0]?.id || '');
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [report?.generatedBy, report?.analysisQuality?.partial, report?.modules?.length, report?.flows?.length, report?.risks?.length]);

  const activeModule = useMemo(() => materials?.courseModules.find((module) => module.id === activeId) || materials?.courseModules[0], [activeId, materials]);
  const activeBrief = useMemo(() => materials?.moduleBriefs.find((brief) => brief.id === activeModule?.briefId), [activeModule, materials]);

  if (!report) return <EmptyState text="先完成一次项目分析，再生成学习课程。" />;
  if (report.analysisQuality?.partial) return <EmptyState text="分析仍在生成中。完整报告完成后再进入学习课程。" />;

  return <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
    <aside className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><GraduationCap size={18} />学习课程</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">把接管报告转成 4-6 个可学习章节。课程内容只消费已验证的模块、链路、风险和真实代码片段。</p>
          <Button type="button" variant="outline" className="w-full justify-start" onClick={onExportCourse} disabled={loading || !materials}>
            <Download size={15} />导出课程包
          </Button>
          {materials && <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="章节" value={materials.courseModules.length} />
            <Metric label="brief" value={materials.moduleBriefs.length} />
            <Metric label="文件" value={materials.evidenceSummary.files} />
            <Metric label="图谱边" value={materials.evidenceSummary.graphEdges} />
          </div>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 pt-4">
          {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" />生成课程材料...</div>}
          {error && <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {materials?.courseModules.map((module, index) => <button
            key={module.id}
            type="button"
            onClick={() => setActiveId(module.id)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${module.id === activeModule?.id ? 'border-blue-200 bg-blue-50 text-blue-800' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <div className="text-xs font-semibold text-slate-500">第 {index + 1} 章</div>
            <div className="mt-1 font-medium">{module.title}</div>
          </button>)}
        </CardContent>
      </Card>
    </aside>

    <main className="min-w-0 space-y-4">
      {!materials && !loading && !error && <EmptyState text="课程材料会基于当前分析报告生成。" />}
      {activeModule && <CourseModuleDetail module={activeModule} brief={activeBrief} />}
    </main>
  </div>;
}

function CourseModuleDetail({ module, brief }: { module: CourseModule; brief?: ModuleBrief }) {
  return <div className="space-y-4">
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-blue-700"><BookOpen size={15} />{module.userAction}</div>
      <h2 className="mt-2 text-2xl font-bold text-slate-950">{module.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{module.whyCare}</p>
      {brief?.openingHook && <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{brief.openingHook}</div>}
      {!!brief?.actors?.length && <div className="mt-4 flex flex-wrap gap-2">{brief.actors.map((actor) => <span key={actor} className="rounded-full border bg-slate-50 px-2 py-1 text-xs text-slate-700">{actor}</span>)}</div>}
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">关联证据</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <EvidenceList title="核心文件" values={module.coreFiles} />
          <EvidenceList title="关联链路" values={module.flows} />
          <EvidenceList title="关联风险" values={module.risks} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Module Brief</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>{brief?.whyCare || module.whyCare}</p>
          <p>预提取代码片段：{brief?.snippets?.length || 0} 个。后续课程写作只需要消费这些 brief，不需要再次塞完整代码库。</p>
        </CardContent>
      </Card>
    </section>

    <section className="space-y-3">
      <SectionTitle title="代码 ↔ 白话解释" description="左侧是原始代码片段，右侧是接管视角的白话说明。" />
      {module.codeTranslations.length ? module.codeTranslations.map((block) => <CodeTranslation key={`${block.path}:${block.startLine}`} block={block} />) : <EmptyState text="当前章节没有可展示的代码片段。" />}
    </section>

    <section className="space-y-3">
      <SectionTitle title="场景题" description="题目用于训练架构判断，不做记忆测试。" />
      {module.quiz.map((quiz, index) => <ScenarioQuizCard key={index} quiz={quiz} />)}
    </section>
  </div>;
}

function CodeTranslation({ block }: { block: CodeTranslationBlock }) {
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><FileCode2 size={16} />{block.path}:{block.startLine}-{block.endLine}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,.9fr)]">
        <pre className="max-h-[360px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100"><code>{block.code}</code></pre>
        <div className="space-y-3 text-sm text-slate-700">
          {block.plainEnglish.map((line) => <div key={line} className="rounded-md border bg-slate-50 p-3">{line}</div>)}
          <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-amber-900">链路位置：{block.roleInFlow}</div>
        </div>
      </div>
    </CardContent>
  </Card>;
}

function ScenarioQuizCard({ quiz }: { quiz: ScenarioQuiz }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><HelpCircle size={16} />{quiz.question}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {quiz.options.map((option, index) => {
        const isCorrect = selected !== null && index === quiz.answerIndex;
        const isWrong = selected === index && index !== quiz.answerIndex;
        return <button
          key={option}
          type="button"
          onClick={() => setSelected(index)}
          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : isWrong ? 'border-red-200 bg-red-50 text-red-800' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {isCorrect && <CheckCircle2 size={15} />}
          <span>{option}</span>
        </button>;
      })}
      {selected !== null && <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">{quiz.explanation}</div>}
    </CardContent>
  </Card>;
}

function EvidenceList({ title, values }: { title: string; values: string[] }) {
  return <div>
    <div className="text-xs font-semibold text-slate-500">{title}</div>
    {values.length ? <ul className="mt-1 space-y-1">{values.slice(0, 8).map((value) => <li key={value} className="truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700" title={value}>{value}</li>)}</ul> : <div className="mt-1 text-xs text-slate-400">无</div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border bg-slate-50 px-2 py-2">
    <div className="text-slate-500">{label}</div>
    <div className="mt-1 font-semibold text-slate-950">{value}</div>
  </div>;
}
