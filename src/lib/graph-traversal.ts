export function dependents(
  edges: { source: string; target: string }[],
  selected: string,
  transitive: boolean,
) {
  const found = new Set([selected]);
  let frontier = [selected];
  while (frontier.length) {
    const next: string[] = [];
    for (const e of edges)
      if (frontier.includes(e.target) && !found.has(e.source)) {
        found.add(e.source);
        next.push(e.source);
      }
    if (!transitive) break;
    frontier = next;
  }
  return found;
}
