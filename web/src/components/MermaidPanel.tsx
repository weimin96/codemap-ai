import { useEffect, useId, useState } from 'react';

let mermaidLoader: Promise<typeof import('mermaid').default> | null = null;
let initialized = false;

function loadMermaid() {
  mermaidLoader ||= import('mermaid').then((module) => {
    const mermaid = module.default;
    if (!initialized) {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
      initialized = true;
    }
    return mermaid;
  });
  return mermaidLoader;
}

export function MermaidPanel({ chart }: { chart?: string }) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!chart?.trim()) {
        setSvg('');
        return;
      }
      try {
        setLoading(true);
        setError('');
        const mermaid = await loadMermaid();
        const result = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) setSvg(result.svg);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void render();
    return () => { cancelled = true; };
  }, [chart, id]);

  if (error) return <pre className="overflow-auto rounded-md bg-red-950/50 p-3 text-xs text-red-200">Mermaid 渲染失败：{error}</pre>;
  if (loading && !svg) return <div className="rounded-lg border bg-slate-950 p-4 text-sm text-slate-300">图表渲染中...</div>;
  return <div className="mermaid overflow-auto rounded-lg border bg-slate-950 p-4" dangerouslySetInnerHTML={{ __html: svg }} />;
}
