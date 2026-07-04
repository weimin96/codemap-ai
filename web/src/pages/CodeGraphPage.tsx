import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Boxes, FileCode2, GitFork, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SectionTitle, StatCard } from '@/components/PageBlocks';
import type { CodeGraph, CodeGraphEdge, CodeGraphNode } from '@/types';

type InspectorTab = 'overview' | 'explain' | 'why' | 'warnings' | 'code';

export function CodeGraphPage({ graph, loading, onLoadGraph, onOpenFile }: {
  graph: CodeGraph | null;
  loading: string;
  onLoadGraph: () => void;
  onOpenFile: (path: string, line?: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [tab, setTab] = useState<InspectorTab>('overview');
  const [explanation, setExplanation] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);
  const explainCacheRef = useRef(new Map<string, string>());

  useEffect(() => {
    if (!graph && loading !== 'code-graph') onLoadGraph();
  }, [graph, loading, onLoadGraph]);

  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const selectedNode = nodes.find((node) => node.id === selectedId) || nodes[0] || null;
  const targetNode = nodes.find((node) => node.id === targetId) || nodes.find((node) => node.id !== selectedNode?.id && node.type !== 'directory') || null;
  const visibleNodes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const candidates = nodes.filter((node) => node.type !== 'directory');
    if (!keyword) return candidates.slice(0, 80);
    return candidates.filter((node) => `${node.name} ${node.path || ''}`.toLowerCase().includes(keyword)).slice(0, 80);
  }, [nodes, query]);
  const relatedEdges = selectedNode ? edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).slice(0, 80) : [];
  const selectedWarnings = selectedNode?.path ? graph?.warnings.filter((warning) => warning.path === selectedNode.path) || [] : [];
  const connection = selectedNode && targetNode ? shortestPath(edges, selectedNode.id, targetNode.id) : [];

  useEffect(() => {
    if (!selectedNode || tab !== 'explain') return;
    const cacheKey = `${graph?.generatedAt || 'graph'}:${selectedNode.id}`;
    const cached = explainCacheRef.current.get(cacheKey);
    if (cached) {
      setExplanation(cached);
      setExplainLoading(false);
      return;
    }
    let cancelled = false;
    setExplainLoading(true);
    setExplanation('');
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const next = buildNodeExplanation({ node: selectedNode, edges: relatedEdges, nodes, warnings: selectedWarnings });
      explainCacheRef.current.set(cacheKey, next);
      setExplanation(next);
      setExplainLoading(false);
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [graph?.generatedAt, nodes, relatedEdges, selectedNode, selectedWarnings, tab]);

  if (!graph) return <div className="space-y-4">
    <SectionTitle title="代码图谱" description="基于 JS/TS 静态扫描构建文件、符号、导入和调用关系。" />
    <EmptyState text={loading === 'code-graph' ? '代码图谱加载中' : '暂无代码图谱'} />
  </div>;

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-4">
      <SectionTitle title="代码图谱" description="用于检查导入关系、近似调用关系和解析告警。" />
      <Button variant="outline" size="sm" onClick={onLoadGraph} disabled={loading === 'code-graph'}>重新生成</Button>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <StatCard icon={<Boxes size={18} />} label="节点" value={graph.totals.nodes} hint="目录、文件、符号" />
      <StatCard icon={<GitFork size={18} />} label="关系" value={graph.totals.edges} hint="contains / defines / imports / calls" tone="purple" />
      <StatCard icon={<FileCode2 size={18} />} label="JS/TS 文件" value={graph.totals.files} hint={graph.languageScope.join(' / ')} tone="green" />
      <StatCard icon={<AlertTriangle size={18} />} label="解析告警" value={graph.totals.warnings} hint="未解析导入或调用" tone={graph.totals.warnings ? 'amber' : 'slate'} />
    </div>

    <GraphCanvas nodes={nodes} edges={edges} selectedId={selectedNode?.id || ''} onSelect={setSelectedId} />

    <div className="grid gap-4 lg:grid-cols-[420px,1fr]">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">节点搜索</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索文件或符号" />
          </div>
        </CardHeader>
        <CardContent className="max-h-[560px] space-y-2 overflow-auto">
          {visibleNodes.map((node) => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className={`w-full rounded-lg border p-3 text-left ${selectedNode?.id === node.id ? 'border-blue-200 bg-blue-50' : 'bg-white hover:bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-950">{node.name}</span>
              <NodeBadge node={node} />
            </div>
            {node.path && <div className="mt-1 truncate font-mono text-xs text-slate-500">{node.path}{node.startLine ? `:${node.startLine}` : ''}</div>}
          </button>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">当前对象 Inspector</CardTitle>
          <div className="flex flex-wrap gap-2">
            {(['overview', 'explain', 'why', 'warnings', 'code'] as InspectorTab[]).map((item) => <Button key={item} type="button" size="sm" variant={tab === item ? 'default' : 'outline'} onClick={() => setTab(item)}>{tabLabel(item)}</Button>)}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedNode && <EmptyState text="选择左侧节点查看详情" />}
          {selectedNode && tab === 'overview' && <OverviewInspector node={selectedNode} edges={relatedEdges} nodes={nodes} onOpenFile={onOpenFile} />}
          {selectedNode && tab === 'explain' && <ExplainInspector loading={explainLoading} explanation={explanation} />}
          {selectedNode && tab === 'why' && <WhyInspector nodes={nodes} selectedNode={selectedNode} targetNode={targetNode} targetId={targetId} connection={connection} onTargetChange={setTargetId} />}
          {selectedNode && tab === 'warnings' && <WarningsInspector warnings={selectedWarnings} />}
          {selectedNode && tab === 'code' && <CodeInspector node={selectedNode} onOpenFile={onOpenFile} />}
        </CardContent>
      </Card>
    </div>
  </div>;
}

function GraphCanvas({ nodes, edges, selectedId, onSelect }: { nodes: CodeGraphNode[]; edges: CodeGraphEdge[]; selectedId: string; onSelect: (id: string) => void }) {
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
      const cy = module.default({
        container: containerRef.current,
        elements,
        minZoom: 0.25,
        maxZoom: 2.5,
        wheelSensitivity: 0.18,
        layout: { name: 'cose', animate: false, padding: 24 },
        style: cytoscapeStyle() as any
      });
      cy.on('tap', 'node', (event: any) => onSelect(event.target.id()));
      cyRef.current = cy;
      if (selectedId) cy.getElementById(selectedId).addClass('selected');
    });
    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [elements, onSelect, selectedId]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('selected');
    if (!selectedId) return;
    const node = cy.getElementById(selectedId);
    node.addClass('selected');
    if (node.length) cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 0.85) }, { duration: 220 });
  }, [selectedId]);

  return <Card>
    <CardHeader><CardTitle className="text-base">交互图谱</CardTitle></CardHeader>
    <CardContent>
      <div ref={containerRef} className="h-[420px] rounded-xl border bg-slate-50" />
      <div className="mt-3 text-xs text-slate-500">显示前 140 个非目录节点和 260 条关系；支持缩放、拖拽、节点点击与 Inspector 联动。</div>
    </CardContent>
  </Card>;
}

function cytoscapeStyle() {
  return [
    { selector: 'node', style: { label: 'data(label)', 'font-size': 10, color: '#0f172a', 'text-valign': 'bottom', 'text-margin-y': 6, 'background-color': '#dbeafe', 'border-color': '#2563eb', 'border-width': 1.5, width: 28, height: 28 } },
    { selector: 'node[type = "file"]', style: { 'background-color': '#dcfce7', 'border-color': '#16a34a', shape: 'round-rectangle', width: 42, height: 26 } },
    { selector: 'node.selected', style: { 'background-color': '#2563eb', 'border-color': '#0f172a', color: '#1d4ed8', 'border-width': 3, width: 38, height: 38 } },
    { selector: 'edge', style: { label: 'data(label)', 'font-size': 8, color: '#64748b', width: 1.2, 'line-color': '#cbd5e1', 'target-arrow-color': '#cbd5e1', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
    { selector: 'edge[type = "calls"]', style: { 'line-color': '#8b5cf6', 'target-arrow-color': '#8b5cf6', width: 1.8 } },
    { selector: 'edge[type = "imports"]', style: { 'line-color': '#0ea5e9', 'target-arrow-color': '#0ea5e9' } }
  ];
}

function OverviewInspector({ node, edges, nodes, onOpenFile }: { node: CodeGraphNode; edges: CodeGraphEdge[]; nodes: CodeGraphNode[]; onOpenFile: (path: string, line?: number) => void }) {
  return <div className="space-y-4">
    <NodeSummary node={node} onOpenFile={onOpenFile} />
    <div className="space-y-2">
      {edges.map((edge) => <GraphEdgeRow key={`${edge.source}-${edge.target}-${edge.type}-${edge.line || ''}`} edge={edge} nodes={nodes} selectedId={node.id} />)}
      {!edges.length && <EmptyState text="该节点暂无直接关系" />}
    </div>
  </div>;
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

function ExplainInspector({ loading, explanation }: { loading: boolean; explanation: string }) {
  if (loading) return <EmptyState text="解释生成中，切换节点会取消旧任务。" />;
  return <div className="rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{explanation || '暂无解释。'}</div>;
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

function buildNodeExplanation({ node, edges, nodes, warnings }: { node: CodeGraphNode; edges: CodeGraphEdge[]; nodes: CodeGraphNode[]; warnings: CodeGraph['warnings'] }) {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const incoming = edges.filter((edge) => edge.target === node.id);
  const byType = edges.reduce<Record<string, number>>((acc, edge) => {
    acc[edge.type] = (acc[edge.type] || 0) + 1;
    return acc;
  }, {});
  const topTargets = outgoing.slice(0, 5).map((edge) => nodes.find((item) => item.id === edge.target)?.name || edge.target);
  const topSources = incoming.slice(0, 5).map((edge) => nodes.find((item) => item.id === edge.source)?.name || edge.source);
  return [
    `对象：${node.name}（${node.type}）`,
    node.path ? `位置：${node.path}${node.startLine ? `:${node.startLine}` : ''}` : '',
    `直接关系：${edges.length} 条；入边 ${incoming.length} 条，出边 ${outgoing.length} 条。`,
    `关系类型：${Object.entries(byType).map(([type, count]) => `${type}=${count}`).join('，') || '无'}。`,
    topSources.length ? `主要来源：${topSources.join('、')}` : '主要来源：无',
    topTargets.length ? `主要指向：${topTargets.join('、')}` : '主要指向：无',
    warnings.length ? `解析告警：${warnings.length} 条，说明该文件存在未解析调用或导入，影响范围判断需要人工复核。` : '解析告警：无。',
    '说明：该解释来自当前静态图谱和会话缓存，不会触发 AI 请求。'
  ].filter(Boolean).join('\n');
}

function tabLabel(tab: InspectorTab) {
  return ({ overview: '概览', explain: '解释', why: '为什么有关', warnings: '告警', code: '代码' })[tab];
}
