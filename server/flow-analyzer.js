export function buildFlowsMermaid(flows) {
  if (!flows?.length) return 'flowchart TD\n  A[触发] --> B[待识别入口]';
  const lines = ['flowchart TD', '  START[用户或系统触发]'];
  flows.forEach((flow, index) => {
    const flowId = `F${index + 1}`;
    lines.push(`  START --> ${flowId}["${escapeMermaid(flow.name)}"]`);
    const firstStep = flow.steps?.[0];
    if (firstStep?.path) lines.push(`  ${flowId} --> ${flowId}S1["${escapeMermaid(firstStep.path)}"]`);
  });
  return lines.join('\n');
}

function escapeMermaid(text) {
  return String(text)
    .replace(/\\/g, '/')
    .replace(/"/g, "'")
    .replace(/[<>]/g, '')
    .slice(0, 96);
}
