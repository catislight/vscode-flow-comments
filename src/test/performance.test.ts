import * as assert from 'assert';
import { parseText } from '../utils/parser';
import { sortGraph } from '../utils/sort';
import { Graph } from '../models/types';

suite('Performance', () => {
  test('parse and sort 1k nodes under 1500ms', () => {
    const lines: string[] = [];
    lines.push('// flow-Perf start');
    for (let i = 1; i <= 1000; i++) {
      lines.push(`// flow-Perf ${i} step ${i}`);
    }
    lines.push('// flow-Perf end');
    const text = lines.join('\n');
    const t0 = Date.now();
    const nodes = parseText(text, '/perf.ts');
    const graph: Graph = { features: { 'Perf': { feature: 'Perf', nodes } } };
    sortGraph(graph);
    const dt = Date.now() - t0;
    assert.ok(dt < 1500, `elapsed ${dt}ms`);
  });
});