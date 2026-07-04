import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Boxes, FileCode2, GitFork, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SectionTitle, StatCard } from '@/components/PageBlocks';
import { ObjectInspector, type ObjectInspectorTab } from '@/components/ObjectInspector';
import type { AiConfig, CodeGraph, CodeGraphEdge, CodeGraphNode, CoreFlow, FilePayload, Report, RiskItem, SymbolInfo } from '@/types';

type InspectorTab = ObjectInspectorTab;
type GraphScope = 'all' | 'module' | 'flow' | 'file' | 'symbol';
type SearchKind = 'all' | 'file' | 'function' | 'module' | 'warning';
type NeighborMode = 'direct' | 'callers' | 'callees' | 'imports' | 'two-hop';
type CanvasRange = 'current' | 'module' | 'flow' | 'file' | 'top';
type CanvasSort = 'importance' | 'risk' | 'entry' | 'degree' | 'search';
type ExplainMode = 'selected' | 'neighbors' | 'flow-impact' | 'risk-path';
type EdgeType = CodeGraphEdge['type'];

export function CodeGraphPage({
  graph,
  report,
  config,
  currentFile,
  currentSymbol,
  activeFlow,
  activeRisk,
  loading,
  onLoadGraph,
  onOpenFile
}: {
  graph: CodeGraph | null;
  report: Report | null;
  config: AiConfig;
  currentFile: FilePayload | null;
  currentSymbol: SymbolInfo | null;
  activeFlow: CoreFlow | null;
  activeRisk: RiskItem | null;
  loading: string;
  onLoadGraph: () => void;
  onOpenFile: (path: string, line?: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [searchKind, setSearchKind] = useState<SearchKind>('all');
  const [scope, setScope] = useState<GraphScope>('all');
  const [moduleId, setModuleId] = useState('');
  const [neighborMode, setNeighborMode] = useState<NeighborMode>('direct');
  const [edgeTypes, setEdgeTypes] = useState<Record<EdgeType, boolean>>({ contains: true, defines: true, imports: true, calls: true });
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [canvasRange, setCanvasRange] = useState<CanvasRange>('current');
  const [canvasSort, setCanvasSort] = useState<CanvasSort>('importance');
  const [selectedId, setSelectedId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [tab, setTab] = useState<InspectorTab>('overview');
  const [explanation, setExplanation] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState('');
  const [explainMode, setExplainMode] = useState<ExplainMode>('selected');
  const explainCacheRef = useRef(new Map<string, string>());

  useEffect(() => {
    if (!graph && loading !== 'code-graph') onLoadGraph();
  }, [graph, loading, onLoadGraph]);

  useEffect(() => {
    if (!moduleId && report?.modules?.[0]) setModuleId(report.modules[0].id || report.modules[0].name);
  }, [moduleId, report?.modules]);

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [] as CodeGraphNode[], edges: [] as CodeGraphEdge[], scopePaths: new Set<string>() };
    return filterGraph({ graph, report, scope, moduleId, activeFlow, activeRisk, currentFile, currentSymbol, query, searchKind, edgeTypes, warningsOnly });
  }, [activeFlow, activeRisk, currentFile, currentSymbol, edgeTypes, graph, moduleId, query, report, scope, searchKind, warningsOnly]);

  const nodes = graphData.nodes;
  const edges = graphData.edges;
  const selectedNode = nodes.find((node) => node.id === selectedId) || nodes[0] || null;
  const targetNode = nodes.find((node) => node.id === targetId) || nodes.find((node) => node.id !== selectedNode?.id && node.type !== 'directory') || null;
  const relatedEdges = selectedNode ? edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).slice(0, 80) : [];
  const selectedWarnings = selectedNode?.path ? graph?.warnings.filter((warning) => warning.path === selectedNode.path) || [] : [];
  const connection = selectedNode && targetNode ? shortestPath(edges, selectedNode.id, targetNode.id) : [];
  const highlightNodeIds = selectedNode ? neighborIds(edges, selectedNode.id, neighborMode) : new Set<string>();
  const businessLinks = selectedNode ? buildBusinessLinks(selectedNode, report, activeFlow, activeRisk) : { modules: [], flows: [], risks: [] };
  const canvasGraph = useMemo(() => graph ? buildCanvasGraph({ graph, filteredNodes: nodes, filteredEdges: edges, report, activeFlow, currentFile, query, range: canvasRange, sort: canvasSort }) : { nodes, edges } as { nodes: CodeGraphNode[]; edges: CodeGraphEdge[] }, [activeFlow, canvasRange, canvasSort, currentFile, edges, graph, nodes, query, report]);

  useEffect(() => {
    if (!selectedNode || tab !== 'explain') return;
    const scopeKey = `${graph?.generatedAt || 'graph'}:${selectedNode.id}:${explainMode}`;
    const cached = explainCacheRef.current.get(scopeKey);
    if (cached) {
      setExplanation(cached);
      setExplainLoading(false);
      setExplainError('');
      return;
    }
    const controller = new AbortController();
    setExplainLoading(true);
    setExplanation('');
    setExplainError('');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/explain-node', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ scopeKey, mode: explainMode, node: selectedNode, relatedEdges, warnings: selectedWarnings, businessLinks, config })
        });
        const data = await response.json().catch(() => null) as { explanation?: string; error?: string } | null;
        if (!response.ok || data?.error) throw new Error(data?.error || `解释失败：${response.status}`);
        const next = data?.explanation || buildNodeExplanation({ node: selectedNode, edges: relatedEdges, nodes, warnings: selectedWarnings, businessLinks, explainMode });
        explainCacheRef.current.set(scopeKey, next);
        setExplanation(next);
      } catch (error) {
        if (controller.signal.aborted) return;
        setExplainError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!controller.signal.aborted) setExplainLoading(false);
      }
    }, 600);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [businessLinks, config, explainMode, graph?.generatedAt, nodes, relatedEdges, selectedNode, selectedWarnings, tab]);

  if (!graph) return <div className="space-y-4">
    <SectionTitle title="代码图谱" description="基于 JS/TS 静态扫描构建文件、符号、导入和调用关系。" />
    <EmptyState text={loading === 'code-graph' ? '代码图谱加载中' : '暂无代码图谱'} />
  </div>;

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-4">
      <SectionTitle title="代码图谱" description="支持范围切换、边过滤、搜索、邻居高亮和业务回链。" />
      <Button variant="outline" size="sm" onClick={onLoadGraph} disabled={loading === 'code-graph'}>重新生成</Button>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <StatCard icon={<Boxes size={18} />} label="节点" value={nodes.length} hint={`总计 ${graph.totals.nodes}`} />
      <StatCard icon={<GitFork size={18} />} label="关系" value={edges.length} hint="过滤后关系" tone="purple" />
      <StatCard icon={<FileCode2 size={18} />} label="JS/TS 文件" value={graph.totals.files} hint={graph.languageScope.join(' / ')} tone="green" />
      <StatCard icon={<AlertTriangle size={18} />} label="解析告警" value={graph.totals.warnings} hint="未解析导入或调用" tone={graph.totals.warnings ? 'amber' : 'slate'} />
    </div>

    <GraphControls
      report={report}
      scope={scope}
      moduleId={moduleId}
      query={query}
      searchKind={searchKind}
      edgeTypes={edgeTypes}
      warningsOnly={warningsOnly}
      neighborMode={neighborMode}
      onScopeChange={setScope}
      onModuleChange={setModuleId}
      onQueryChange={setQuery}
      onSearchKindChange={setSearchKind}
      onToggleEdge={(type) => setEdgeTypes((current) => ({ ...current, [type]: !current[type] }))}
      onWarningsOnlyChange={setWarningsOnly}
      onNeighborModeChange={setNeighborMode}
      canvasRange={canvasRange}
      canvasSort={canvasSort}
      onCanvasRangeChange={setCanvasRange}
      onCanvasSortChange={setCanvasSort}
    />

    <GraphCanvas nodes={canvasGraph.nodes} edges={canvasGraph.edges} selectedId={selectedNode?.id || ''} highlightNodeIds={highlightNodeIds} range={canvasRange} sort={canvasSort} onSelect={setSelectedId} />

    <div className="grid gap-4 lg:grid-cols-[420px,1fr]">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">节点搜索结果</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="按文件、函数、模块或 warning 搜索" />
          </div>
        </CardHeader>
        <CardContent className="max-h-[560px] space-y-2 overflow-auto">
          {nodes.filter((node) => node.type !== 'directory').slice(0, 100).map((node) => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className={`w-full rounded-lg border p-3 text-left ${selectedNode?.id === node.id ? 'border-blue-200 bg-blue-50' : highlightNodeIds.has(node.id) ? 'border-purple-200 bg-purple-50' : 'bg-white hover:bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-950">{node.name}</span>
              <NodeBadge node={node} />
            </div>
            {node.path && <div className="mt-1 truncate font-mono text-xs text-slate-500">{node.path}{node.startLine ? `:${node.startLine}` : ''}</div>}
          </button>)}
          {!nodes.length && <EmptyState text="当前范围和过滤条件下没有节点" />}
        </CardContent>
      </Card>

      {selectedNode ? <ObjectInspector
        objectType="node"
        title={selectedNode.name}
        subtitle={selectedNode.path || selectedNode.id}
        activeTab={tab}
        onTabChange={setTab}
        tabs={[
          { id: 'overview', content: <OverviewInspector node={selectedNode} edges={relatedEdges} nodes={nodes} businessLinks={businessLinks} onOpenFile={onOpenFile} /> },
          { id: 'explain', content: <ExplainInspector mode={explainMode} onModeChange={setExplainMode} loading={explainLoading} explanation={explanation} error={explainError} fallback={() => buildNodeExplanation({ node: selectedNode, edges: relatedEdges, nodes, warnings: selectedWarnings, businessLinks, explainMode })} /> },
          { id: 'why-connected', content: <WhyInspector nodes={nodes} selectedNode={selectedNode} targetNode={targetNode} targetId={targetId} connection={connection} onTargetChange={setTargetId} /> },
          { id: 'warnings', content: <WarningsInspector warnings={selectedWarnings} /> },
          { id: 'code', content: <CodeInspector node={selectedNode} onOpenFile={onOpenFile} /> }
        ]}
      /> : <Card><CardContent className="p-5"><EmptyState text="选择左侧节点查看详情" /></CardContent></Card>}
    </div>
  </div>;
}

function GraphControls({ report, scope, moduleId, query, searchKind, edgeTypes, warningsOnly, neighborMode, canvasRange, canvasSort, onScopeChange, onModuleChange, onQueryChange, onSearchKindChange, onToggleEdge, onWarningsOnlyChange, onNeighborModeChange, onCanvasRangeChange, onCanvasSortChange }: {
  report: Report | null;
  scope: GraphScope;
  moduleId: string;
  query: string;
  searchKind: SearchKind;
  edgeTypes: Record<EdgeType, boolean>;
  warningsOnly: boolean;
  neighborMode: NeighborMode;
  canvasRange: CanvasRange;
  canvasSort: CanvasSort;
  onScopeChange: (scope: GraphScope) => void;
  onModuleChange: (id: string) => void;
  onQueryChange: (value: string) => void;
  onSearchKindChange: (kind: SearchKind) => void;
  onToggleEdge: (type: EdgeType) => void;
  onWarningsOnlyChange: (value: boolean) => void;
  onNeighborModeChange: (mode: NeighborMode) => void;
  onCanvasRangeChange: (range: CanvasRange) => void;
  onCanvasSortChange: (sort: CanvasSort) => void;
}) {
  return <Card>
    <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-500">范围切换</div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'module', 'flow', 'file', 'symbol'] as GraphScope[]).map((item) => <Button key={item} size="sm" variant={scope === item ? 'default' : 'outline'} onClick={() => onScopeChange(item)}>{scopeLabel(item)}</Button>)}
        </div>
        {scope === 'module' && <select value={moduleId} onChange={(event) => onModuleChange(event.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
          {(report?.modules || []).map((module) => <option key={module.id || module.name} value={module.id || module.name}>{module.name}</option>)}
        </select>}
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-500">过滤</div>
        <div className="flex flex-wrap gap-2">
          {(['contains', 'defines', 'imports', 'calls'] as EdgeType[]).map((type) => <Button key={type} size="sm" variant={edgeTypes[type] ? 'default' : 'outline'} onClick={() => onToggleEdge(type)}>{type}</Button>)}
          <Button size="sm" variant={warningsOnly ? 'default' : 'outline'} onClick={() => onWarningsOnlyChange(!warningsOnly)}>warnings only</Button>
        </div>
        <select value={neighborMode} onChange={(event) => onNeighborModeChange(event.target.value as NeighborMode)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
          <option value="direct">直接邻居</option>
          <option value="callers">直接调用方</option>
          <option value="callees">直接被调用方</option>
          <option value="imports">import 依赖</option>
          <option value="two-hop">2-hop 影响范围</option>
        </select>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-500">画布显示</div>
        <select value={canvasRange} onChange={(event) => onCanvasRangeChange(event.target.value as CanvasRange)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
          <option value="current">当前过滤结果</option>
          <option value="module">当前模块</option>
          <option value="flow">当前链路</option>
          <option value="file">当前文件</option>
          <option value="top">全项目 Top 140</option>
        </select>
        <select value={canvasSort} onChange={(event) => onCanvasSortChange(event.target.value as CanvasSort)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
          <option value="importance">重要性</option>
          <option value="risk">风险相关</option>
          <option value="entry">入口相关</option>
          <option value="degree">调用度</option>
          <option value="search">最近搜索</option>
        </select>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-500">搜索</div>
        <select value={searchKind} onChange={(event) => onSearchKindChange(event.target.value as SearchKind)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
          <option value="all">全部</option>
          <option value="file">按文件名</option>
          <option value="function">按函数名</option>
          <option value="module">按模块名</option>
          <option value="warning">按 warning 类型</option>
        </select>
        <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="输入搜索词" />
      </div>
    </CardContent>
  </Card>;
}

function GraphCanvas({ nodes, edges, selectedId, highlightNodeIds, range, sort, onSelect }: { nodes: CodeGraphNode[]; edges: CodeGraphEdge[]; selectedId: string; highlightNodeIds: Set<string>; range: CanvasRange; sort: CanvasSort; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);
  const elements = useMemo(() => {
    const graphNodes = nodes.filter((node) => node.type !== 'directory').slice(0, 140);
    const nodeIds = new Set(graphNodes.map((node) => node.id));
    const graphEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).slice(0, 260);
    return [
      ...graphNodes.map((node) => ({ data: { id: node.id, label: node.name, type: node.type } })),
      ...graphEdges.map((edge, index) => ({ data: { id: `edge-${index}`, source: edge.source, target: edge.target, label: edge.type, type: edge.type } }))
    ];
  }, [nodes, edges]);

  useEffect(() => {
    let cancelled = false;
    void import('cytoscape').then((module) => {
      if (cancelled || !containerRef.current) return;
      const cy = module.default({ container: containerRef.current, elements, minZoom: 0.25, maxZoom: 2.5, wheelSensitivity: 0.18, layout: { name: 'cose', animate: false, padding: 24 }, style: cytoscapeStyle() as any });
      cy.on('tap', 'node', (event: any) => onSelect(event.target.id()));
      cyRef.current = cy;
      markCanvas(cy, selectedId, highlightNodeIds);
    });
    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [elements, onSelect, selectedId, highlightNodeIds]);

  useEffect(() => {
    if (cyRef.current) markCanvas(cyRef.current, selectedId, highlightNodeIds);
  }, [highlightNodeIds, selectedId]);

  return <Card>
    <CardHeader><CardTitle className="text-base">交互图谱</CardTitle></CardHeader>
    <CardContent>
      <div ref={containerRef} className="h-[420px] rounded-xl border bg-slate-50" />
      <div className="mt-3 text-xs text-slate-500">当前画布：{canvasRangeLabel(range)} / {canvasSortLabel(sort)}；最多显示 140 个非目录节点和 260 条关系，避免大项目首屏过载。</div>
    </CardContent>
  </Card>;
}

function markCanvas(cy: any, selectedId: string, highlightNodeIds: Set<string>) {
  cy.nodes().removeClass('selected highlighted dimmed');
  cy.edges().removeClass('highlighted dimmed');
  if (!selectedId) return;
  const selected = cy.getElementById(selectedId);
  const highlighted = Array.from(highlightNodeIds).map((id) => cy.getElementById(id));
  cy.nodes().addClass('dimmed');
  cy.edges().addClass('dimmed');
  selected.removeClass('dimmed').addClass('selected');
  for (const node of highlighted) node.removeClass('dimmed').addClass('highlighted');
  selected.connectedEdges().removeClass('dimmed').addClass('highlighted');
  if (selected.length) cy.animate({ center: { eles: selected }, zoom: Math.max(cy.zoom(), 0.85) }, { duration: 220 });
}

function cytoscapeStyle() {
  return [
    { selector: 'node', style: { label: 'data(label)', 'font-size': 10, color: '#0f172a', 'text-valign': 'bottom', 'text-margin-y': 6, 'background-color': '#dbeafe', 'border-color': '#2563eb', 'border-width': 1.5, width: 28, height: 28 } },
    { selector: 'node[type = "file"]', style: { 'background-color': '#dcfce7', 'border-color': '#16a34a', shape: 'round-rectangle', width: 42, height: 26 } },
    { selector: 'node.selected', style: { 'background-color': '#2563eb', 'border-color': '#0f172a', color: '#1d4ed8', 'border-width': 3, width: 38, height: 38 } },
    { selector: 'node.highlighted', style: { 'background-color': '#f5d0fe', 'border-color': '#9333ea', 'border-width': 3 } },
    { selector: 'node.dimmed', style: { opacity: 0.25 } },
    { selector: 'edge', style: { label: 'data(label)', 'font-size': 8, color: '#64748b', width: 1.2, 'line-color': '#cbd5e1', 'target-arrow-color': '#cbd5e1', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
    { selector: 'edge[type = "calls"]', style: { 'line-color': '#8b5cf6', 'target-arrow-color': '#8b5cf6', width: 1.8 } },
    { selector: 'edge[type = "imports"]', style: { 'line-color': '#0ea5e9', 'target-arrow-color': '#0ea5e9' } },
    { selector: 'edge.highlighted', style: { width: 3, opacity: 1 } },
    { selector: 'edge.dimmed', style: { opacity: 0.16 } }
  ];
}

function OverviewInspector({ node, edges, nodes, businessLinks, onOpenFile }: { node: CodeGraphNode; edges: CodeGraphEdge[]; nodes: CodeGraphNode[]; businessLinks: BusinessLinks; onOpenFile: (path: string, line?: number) => void }) {
  return <div className="space-y-4">
    <NodeSummary node={node} onOpenFile={onOpenFile} />
    <BusinessBacklinks links={businessLinks} />
    <div className="space-y-2">
      {edges.map((edge) => <GraphEdgeRow key={`${edge.source}-${edge.target}-${edge.type}-${edge.line || ''}`} edge={edge} nodes={nodes} selectedId={node.id} />)}
      {!edges.length && <EmptyState text="该节点暂无直接关系" />}
    </div>
  </div>;
}

function BusinessBacklinks({ links }: { links: BusinessLinks }) {
  return <div className="grid gap-2 rounded-xl border bg-slate-50 p-3 text-sm">
    <BacklinkLine label="所属模块" values={links.modules.map((item) => item.name)} />
    <BacklinkLine label="影响链路" values={links.flows.map((item) => item.name)} />
    <BacklinkLine label="关联风险" values={links.risks.map((item) => item.title)} />
  </div>;
}

function BacklinkLine({ label, values }: { label: string; values: string[] }) {
  return <div><span className="text-xs font-medium text-slate-500">{label}：</span>{values.length ? values.slice(0, 4).join('、') : '暂无'}</div>;
}

function WhyInspector({ nodes, selectedNode, targetNode, targetId, connection, onTargetChange }: { nodes: CodeGraphNode[]; selectedNode: CodeGraphNode; targetNode: CodeGraphNode | null; targetId: string; connection: Array<{ from: string; to: string; edge: CodeGraphEdge }>; onTargetChange: (id: string) => void }) {
  const candidates = nodes.filter((node) => node.type !== 'directory' && node.id !== selectedNode.id).slice(0, 200);
  return <div className="space-y-4">
    <div>
      <label className="text-xs font-medium text-slate-500">目标节点</label>
      <select value={targetId || targetNode?.id || ''} onChange={(event) => onTargetChange(event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm">
        {candidates.map((node) => <option key={node.id} value={node.id}>{node.name} · {node.path || node.type}</option>)}
      </select>
    </div>
    {targetNode && <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">{selectedNode.name} 与 {targetNode.name} 的最短关联路径。</div>}
    <div className="space-y-2">
      {connection.map((item, index) => <PathRow key={`${item.from}-${item.to}-${index}`} item={item} nodes={nodes} />)}
      {targetNode && !connection.length && <EmptyState text="未找到关联路径" />}
    </div>
  </div>;
}

function ExplainInspector({ mode, onModeChange, loading, explanation, error, fallback }: { mode: ExplainMode; onModeChange: (mode: ExplainMode) => void; loading: boolean; explanation: string; error: string; fallback: () => string }) {
  return <div className="space-y-3">
    <div className="rounded-xl border bg-slate-50 p-3">
      <div className="mb-2 text-xs font-medium text-slate-500">解释范围</div>
      <div className="flex flex-wrap gap-2">
        {(['selected', 'neighbors', 'flow-impact', 'risk-path'] as ExplainMode[]).map((item) => <Button key={item} size="sm" variant={mode === item ? 'default' : 'outline'} onClick={() => onModeChange(item)}>{explainModeLabel(item)}</Button>)}
      </div>
      <div className="mt-2 text-xs text-slate-500">不提供 Explain All，避免高费用、浅上下文和伪确定性。</div>
    </div>
    {loading && <EmptyState text="解释生成中，切换节点或解释范围会取消旧请求。" />}
    {!loading && error && <div className="space-y-3">
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-800">AI Explain 失败：{error}</div>
      <div className="rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{fallback()}</div>
    </div>}
    {!loading && !error && <div className="rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{explanation || '暂无解释。'}</div>}
  </div>;
}

function WarningsInspector({ warnings }: { warnings: CodeGraph['warnings'] }) {
  if (!warnings.length) return <EmptyState text="当前文件暂无解析告警" />;
  return <div className="space-y-2">
    {warnings.map((warning, index) => <div key={`${warning.kind}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="font-medium">{warning.kind}</div>
      <div className="mt-1">{warning.message}</div>
    </div>)}
  </div>;
}

function CodeInspector({ node, onOpenFile }: { node: CodeGraphNode; onOpenFile: (path: string, line?: number) => void }) {
  return <div className="space-y-4">
    <NodeSummary node={node} onOpenFile={onOpenFile} />
    {node.path ? <Button variant="outline" onClick={() => onOpenFile(node.path || '', node.startLine)}>在代码浏览器中打开</Button> : <EmptyState text="目录节点没有可打开代码" />}
  </div>;
}

function NodeSummary({ node, onOpenFile }: { node: CodeGraphNode; onOpenFile: (path: string, line?: number) => void }) {
  return <div className="rounded-xl border bg-slate-50 p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><div className="truncate text-base font-semibold text-slate-950">{node.name}</div><NodeBadge node={node} /></div>
        <div className="mt-1 truncate font-mono text-xs text-slate-500">{node.id}</div>
        {node.path && <div className="mt-1 truncate font-mono text-xs text-slate-500">{node.path}{node.startLine ? `:${node.startLine}` : ''}</div>}
      </div>
      {node.path && <Button variant="outline" size="sm" onClick={() => onOpenFile(node.path || '', node.startLine)}>打开代码</Button>}
    </div>
  </div>;
}

function NodeBadge({ node }: { node: CodeGraphNode }) {
  const variant = node.type === 'file' ? 'secondary' : node.type === 'directory' ? 'outline' : 'default';
  return <Badge variant={variant}>{node.type}</Badge>;
}

function GraphEdgeRow({ edge, nodes, selectedId }: { edge: CodeGraphEdge; nodes: CodeGraphNode[]; selectedId: string }) {
  const isOutgoing = edge.source === selectedId;
  const other = nodes.find((node) => node.id === (isOutgoing ? edge.target : edge.source));
  return <div className="flex items-start gap-3 rounded-lg border p-3">
    <Badge variant={edge.type === 'calls' ? 'default' : 'outline'}>{edge.type}</Badge>
    <div className="min-w-0 flex-1">
      <div className="text-sm text-slate-700">{isOutgoing ? '指向' : '来自'} <span className="font-semibold text-slate-950">{other?.name || (isOutgoing ? edge.target : edge.source)}</span></div>
      {other?.path && <div className="mt-1 truncate font-mono text-xs text-slate-500">{other.path}{edge.line ? `:${edge.line}` : ''}</div>}
    </div>
  </div>;
}

function PathRow({ item, nodes }: { item: { from: string; to: string; edge: CodeGraphEdge }; nodes: CodeGraphNode[] }) {
  const from = nodes.find((node) => node.id === item.from);
  const to = nodes.find((node) => node.id === item.to);
  return <div className="rounded-lg border p-3 text-sm">
    <div className="font-medium text-slate-950">{from?.name || item.from} → {to?.name || item.to}</div>
    <div className="mt-1 text-xs text-slate-500">关系：{item.edge.type}</div>
  </div>;
}

function buildCanvasGraph({ graph, filteredNodes, filteredEdges, report, activeFlow, currentFile, query, range, sort }: {
  graph: CodeGraph;
  filteredNodes: CodeGraphNode[];
  filteredEdges: CodeGraphEdge[];
  report: Report | null;
  activeFlow: CoreFlow | null;
  currentFile: FilePayload | null;
  query: string;
  range: CanvasRange;
  sort: CanvasSort;
}) {
  let nodes = filteredNodes;
  if (range === 'top') nodes = graph.nodes.filter((node) => node.type !== 'directory');
  if (range === 'module') {
    const paths = new Set((report?.modules?.[0]?.paths || []));
    nodes = graph.nodes.filter((node) => node.path && Array.from(paths).some((path) => node.path === path || node.path?.startsWith(`${path}/`)));
  }
  if (range === 'flow') {
    const paths = flowPaths(activeFlow);
    nodes = graph.nodes.filter((node) => node.path && paths.has(node.path));
  }
  if (range === 'file') nodes = graph.nodes.filter((node) => node.path && currentFile?.path && node.path === currentFile.path);
  const degree = degreeMap(graph.edges || []);
  const sorted = [...nodes].sort((a, b) => canvasScore(b, { sort, degree, report, query }) - canvasScore(a, { sort, degree, report, query }) || a.name.localeCompare(b.name));
  const selectedNodes = sorted.slice(0, 140);
  const ids = new Set(selectedNodes.map((node) => node.id));
  const sourceEdges = range === 'current' ? filteredEdges : graph.edges;
  const edges = sourceEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).slice(0, 260);
  return { nodes: selectedNodes, edges };
}

function degreeMap(edges: CodeGraphEdge[]) {
  const map = new Map<string, number>();
  for (const edge of edges) {
    map.set(edge.source, (map.get(edge.source) || 0) + 1);
    map.set(edge.target, (map.get(edge.target) || 0) + 1);
  }
  return map;
}

function canvasScore(node: CodeGraphNode, { sort, degree, report, query }: { sort: CanvasSort; degree: Map<string, number>; report: Report | null; query: string }) {
  const path = node.path || '';
  if (sort === 'degree') return degree.get(node.id) || 0;
  if (sort === 'risk') return (report?.risks || []).some((risk) => risk.path === path || risk.evidence?.some((item) => item.path === path)) ? 100 : 0;
  if (sort === 'entry') return /route|controller|handler|server|main|index|cli|bin\//i.test(path) ? 100 : 0;
  if (sort === 'search') return query && `${node.name} ${path}`.toLowerCase().includes(query.toLowerCase()) ? 100 : 0;
  return importanceScore(node, degree);
}

function importanceScore(node: CodeGraphNode, degree: Map<string, number>) {
  const base = node.type === 'file' ? 40 : ['function', 'method', 'class'].includes(node.type) ? 30 : 10;
  return base + (degree.get(node.id) || 0) * 4;
}

function filterGraph({ graph, report, scope, moduleId, activeFlow, activeRisk, currentFile, currentSymbol, query, searchKind, edgeTypes, warningsOnly }: {
  graph: CodeGraph;
  report: Report | null;
  scope: GraphScope;
  moduleId: string;
  activeFlow: CoreFlow | null;
  activeRisk: RiskItem | null;
  currentFile: FilePayload | null;
  currentSymbol: SymbolInfo | null;
  query: string;
  searchKind: SearchKind;
  edgeTypes: Record<EdgeType, boolean>;
  warningsOnly: boolean;
}) {
  const warningPaths = new Set(graph.warnings.map((warning) => warning.path));
  const scopePaths = pathsForScope({ report, scope, moduleId, activeFlow, activeRisk, currentFile, currentSymbol });
  const scopeIds = idsForScope({ scope, currentSymbol });
  const keyword = query.trim().toLowerCase();
  const moduleMatches = matchedModulePaths(report, keyword);
  const warningMatches = matchedWarningPaths(graph, keyword);
  const baseNodes = graph.nodes.filter((node) => {
    if (scopePaths.size && node.path && !scopePaths.has(node.path)) return false;
    if (scopeIds.size && !scopeIds.has(node.id) && (!node.path || !scopePaths.has(node.path))) return false;
    if (warningsOnly && (!node.path || !warningPaths.has(node.path))) return false;
    if (!keyword) return true;
    if (searchKind === 'file') return node.path?.toLowerCase().includes(keyword) || false;
    if (searchKind === 'function') return ['function', 'method', 'class', 'interface'].includes(node.type) && node.name.toLowerCase().includes(keyword);
    if (searchKind === 'module') return node.path ? moduleMatches.has(node.path) : false;
    if (searchKind === 'warning') return node.path ? warningMatches.has(node.path) : false;
    return `${node.name} ${node.path || ''} ${node.type}`.toLowerCase().includes(keyword);
  });
  const nodeIds = new Set(baseNodes.map((node) => node.id));
  const filteredEdges = graph.edges.filter((edge) => edgeTypes[edge.type] && nodeIds.has(edge.source) && nodeIds.has(edge.target));
  return { nodes: baseNodes, edges: filteredEdges, scopePaths };
}

function pathsForScope({ report, scope, moduleId, activeFlow, activeRisk, currentFile, currentSymbol }: { report: Report | null; scope: GraphScope; moduleId: string; activeFlow: CoreFlow | null; activeRisk: RiskItem | null; currentFile: FilePayload | null; currentSymbol: SymbolInfo | null }) {
  const paths = new Set<string>();
  if (scope === 'module') {
    const module = report?.modules.find((item) => (item.id || item.name) === moduleId);
    for (const path of module?.paths || []) paths.add(path);
    for (const item of evidenceRefs(module?.evidence)) if (item.path) paths.add(item.path);
  }
  if (scope === 'flow') for (const path of flowPaths(activeFlow)) paths.add(path);
  if (scope === 'file' && currentFile?.path) paths.add(currentFile.path);
  if (scope === 'symbol' && currentSymbol?.path) paths.add(currentSymbol.path);
  if (scope === 'flow' && activeRisk) for (const path of riskPaths(activeRisk)) paths.add(path);
  return paths;
}

function idsForScope({ scope, currentSymbol }: { scope: GraphScope; currentSymbol: SymbolInfo | null }) {
  const ids = new Set<string>();
  if (scope === 'symbol' && currentSymbol?.id) ids.add(currentSymbol.id);
  return ids;
}

function flowPaths(flow: CoreFlow | null) {
  const paths = new Set<string>();
  for (const step of flow?.steps || []) if (step.path) paths.add(step.path);
  for (const item of flow?.evidence || []) if (item.path) paths.add(item.path);
  return paths;
}

function riskPaths(risk: RiskItem | null) {
  const paths = new Set<string>();
  if (risk?.path) paths.add(risk.path);
  for (const item of risk?.evidence || []) if (item.path) paths.add(item.path);
  return paths;
}

function matchedModulePaths(report: Report | null, keyword: string) {
  const paths = new Set<string>();
  if (!keyword) return paths;
  for (const module of report?.modules || []) {
    if (!`${module.name} ${module.id}`.toLowerCase().includes(keyword)) continue;
    for (const path of module.paths || []) paths.add(path);
    for (const item of evidenceRefs(module.evidence)) if (item.path) paths.add(item.path);
  }
  return paths;
}

function matchedWarningPaths(graph: CodeGraph, keyword: string) {
  const paths = new Set<string>();
  if (!keyword) return paths;
  for (const warning of graph.warnings) {
    if (`${warning.kind} ${warning.message} ${warning.path}`.toLowerCase().includes(keyword)) paths.add(warning.path);
  }
  return paths;
}

function neighborIds(edges: CodeGraphEdge[], selectedId: string, mode: NeighborMode) {
  const ids = new Set<string>();
  const firstHop = edges.filter((edge) => edge.source === selectedId || edge.target === selectedId);
  for (const edge of firstHop) {
    if (mode === 'callers' && edge.type === 'calls' && edge.target === selectedId) ids.add(edge.source);
    if (mode === 'callees' && edge.type === 'calls' && edge.source === selectedId) ids.add(edge.target);
    if (mode === 'imports' && edge.type === 'imports') ids.add(edge.source === selectedId ? edge.target : edge.source);
    if (mode === 'direct' || mode === 'two-hop') ids.add(edge.source === selectedId ? edge.target : edge.source);
  }
  if (mode === 'two-hop') {
    for (const id of Array.from(ids)) {
      for (const edge of edges) {
        if (edge.source === id) ids.add(edge.target);
        if (edge.target === id) ids.add(edge.source);
      }
    }
  }
  return ids;
}

type BusinessLinks = { modules: Report['modules']; flows: Report['flows']; risks: Report['risks'] };

function buildBusinessLinks(node: CodeGraphNode, report: Report | null, activeFlow: CoreFlow | null, activeRisk: RiskItem | null): BusinessLinks {
  const path = node.path || '';
  const modules = (report?.modules || []).filter((module) => includesPath(module.paths, path) || includesEvidence(module.evidence, path));
  const flows = (report?.flows || []).filter((flow) => includesPath(Array.from(flowPaths(flow)), path) || (activeFlow && flow.id === activeFlow.id));
  const risks = (report?.risks || []).filter((risk) => risk.path === path || includesEvidence(risk.evidence, path) || (activeRisk && risk.id === activeRisk.id));
  return { modules, flows, risks };
}

function includesPath(paths: string[] = [], path: string) {
  return Boolean(path) && paths.some((item) => item === path || path.startsWith(`${item}/`) || item.startsWith(`${path}/`));
}

function includesEvidence(evidence: unknown, path: string) {
  return Boolean(path) && evidenceRefs(evidence).some((item) => item.path === path);
}

function evidenceRefs(evidence: unknown): Array<{ path?: string }> {
  return Array.isArray(evidence) ? evidence.filter((item) => typeof item === 'object' && item !== null) as Array<{ path?: string }> : [];
}

function shortestPath(edges: CodeGraphEdge[], sourceId: string, targetId: string) {
  if (!sourceId || !targetId || sourceId === targetId) return [];
  const adjacency = new Map<string, Array<{ nodeId: string; edge: CodeGraphEdge }>>();
  for (const edge of edges) {
    addAdjacent(adjacency, edge.source, { nodeId: edge.target, edge });
    addAdjacent(adjacency, edge.target, { nodeId: edge.source, edge });
  }
  const queue = [sourceId];
  const visited = new Set([sourceId]);
  const previous = new Map<string, { nodeId: string; edge: CodeGraphEdge }>();
  while (queue.length) {
    const current = queue.shift() || '';
    for (const next of adjacency.get(current) || []) {
      if (visited.has(next.nodeId)) continue;
      visited.add(next.nodeId);
      previous.set(next.nodeId, { nodeId: current, edge: next.edge });
      if (next.nodeId === targetId) return rebuildPath(previous, sourceId, targetId);
      queue.push(next.nodeId);
    }
  }
  return [];
}

function addAdjacent(adjacency: Map<string, Array<{ nodeId: string; edge: CodeGraphEdge }>>, source: string, target: { nodeId: string; edge: CodeGraphEdge }) {
  const list = adjacency.get(source) || [];
  list.push(target);
  adjacency.set(source, list);
}

function rebuildPath(previous: Map<string, { nodeId: string; edge: CodeGraphEdge }>, sourceId: string, targetId: string) {
  const items: Array<{ from: string; to: string; edge: CodeGraphEdge }> = [];
  let current = targetId;
  while (current !== sourceId) {
    const item = previous.get(current);
    if (!item) return [];
    items.unshift({ from: item.nodeId, to: current, edge: item.edge });
    current = item.nodeId;
  }
  return items;
}

function buildNodeExplanation({ node, edges, nodes, warnings, businessLinks, explainMode = 'selected' }: { node: CodeGraphNode; edges: CodeGraphEdge[]; nodes: CodeGraphNode[]; warnings: CodeGraph['warnings']; businessLinks: BusinessLinks; explainMode?: ExplainMode }) {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const incoming = edges.filter((edge) => edge.target === node.id);
  const byType = edges.reduce<Record<string, number>>((acc, edge) => {
    acc[edge.type] = (acc[edge.type] || 0) + 1;
    return acc;
  }, {});
  const topTargets = outgoing.slice(0, 5).map((edge) => nodes.find((item) => item.id === edge.target)?.name || edge.target);
  const topSources = incoming.slice(0, 5).map((edge) => nodes.find((item) => item.id === edge.source)?.name || edge.source);
  return [
    `解释范围：${explainModeLabel(explainMode)}`,
    `对象：${node.name}（${node.type}）`,
    node.path ? `位置：${node.path}${node.startLine ? `:${node.startLine}` : ''}` : '',
    `直接关系：${edges.length} 条；入边 ${incoming.length} 条，出边 ${outgoing.length} 条。`,
    `关系类型：${Object.entries(byType).map(([type, count]) => `${type}=${count}`).join('，') || '无'}。`,
    topSources.length ? `主要来源：${topSources.join('、')}` : '主要来源：无',
    topTargets.length ? `主要指向：${topTargets.join('、')}` : '主要指向：无',
    explainMode === 'neighbors' ? '解释重点：优先检查直接邻居和 2-hop 影响范围，确认调用方、被调用方和 import 依赖。' : '',
    explainMode === 'flow-impact' ? '解释重点：优先判断该对象是否处于当前链路步骤、入口、服务层或数据读写路径中。' : '',
    explainMode === 'risk-path' ? '解释重点：优先判断该对象是否关联风险证据、解析告警、状态变化或外部调用。' : '',
    businessLinks.modules.length ? `所属模块：${businessLinks.modules.map((item) => item.name).join('、')}` : '所属模块：暂无匹配',
    businessLinks.flows.length ? `影响链路：${businessLinks.flows.map((item) => item.name).join('、')}` : '影响链路：暂无匹配',
    businessLinks.risks.length ? `关联风险：${businessLinks.risks.map((item) => item.title).join('、')}` : '关联风险：暂无匹配',
    warnings.length ? `解析告警：${warnings.length} 条，说明该文件存在未解析调用或导入，影响范围判断需要人工复核。` : '解析告警：无。',
    '说明：该解释来自当前静态图谱和会话缓存，不会触发 AI 请求。'
  ].filter(Boolean).join('\n');
}

function scopeLabel(scope: GraphScope) {
  return ({ all: '全项目', module: '当前模块', flow: '当前链路', file: '当前文件', symbol: '当前函数' })[scope];
}

function canvasRangeLabel(range: CanvasRange) {
  return ({ current: '当前过滤结果', module: '当前模块', flow: '当前链路', file: '当前文件', top: '全项目 Top 140' })[range];
}

function explainModeLabel(mode: ExplainMode) {
  return ({ selected: 'Explain selected', neighbors: 'Explain neighbors', 'flow-impact': 'Explain current flow impact', 'risk-path': 'Explain risk path' })[mode];
}

function canvasSortLabel(sort: CanvasSort) {
  return ({ importance: '重要性', risk: '风险相关', entry: '入口相关', degree: '调用度', search: '最近搜索' })[sort];
}

