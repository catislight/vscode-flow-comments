import * as assert from 'assert';
import { sortFeatureGraph } from '../utils/sort';
import { createNodeId, FeatureGraph, Node } from '../models/types';

suite('Sorter', () => {
  test('role and order sort', () => {
    const file = '/tmp/a.ts';
    const nodes: Node[] = [
      { id: createNodeId('F', 'step', { levels: [1,2] }, file, 4), feature: 'F', role: 'step', order: { levels: [1,2] }, file, line: 4 },
      { id: createNodeId('F', 'end', undefined, file, 5), feature: 'F', role: 'end', file, line: 5 },
      { id: createNodeId('F', 'start', undefined, file, 1), feature: 'F', role: 'start', file, line: 1 },
      { id: createNodeId('F', 'step', { levels: [1,1] }, file, 3), feature: 'F', role: 'step', order: { levels: [1,1] }, file, line: 3 },
      { id: createNodeId('F', 'step', { levels: [1] }, file, 2), feature: 'F', role: 'step', order: { levels: [1] }, file, line: 2 },
    ];
    const fg: FeatureGraph = { feature: 'F', nodes };
    const sorted = sortFeatureGraph(fg).nodes;
    assert.strictEqual(sorted[0].role, 'start');
    assert.strictEqual(sorted[1].role, 'step');
    assert.deepStrictEqual(sorted[1].order!.levels, [1]);
    assert.deepStrictEqual(sorted[2].order!.levels, [1,1]);
    assert.deepStrictEqual(sorted[3].order!.levels, [1,2]);
    assert.strictEqual(sorted[4].role, 'end');
  });

  test('equal orders keep relative grouping before end', () => {
    const file = '/tmp/b.ts';
    const nodes: Node[] = [
      { id: createNodeId('F', 'start', undefined, file, 1), feature: 'F', role: 'start', file, line: 1 },
      { id: createNodeId('F', 'step', { levels: [2] }, file, 3), feature: 'F', role: 'step', order: { levels: [2] }, file, line: 3 },
      { id: createNodeId('F', 'step', { levels: [2] }, file, 4), feature: 'F', role: 'step', order: { levels: [2] }, file, line: 4 },
      { id: createNodeId('F', 'end', undefined, file, 99), feature: 'F', role: 'end', file, line: 99 },
    ];
    const fg: FeatureGraph = { feature: 'F', nodes };
    const sorted = sortFeatureGraph(fg).nodes;
    assert.strictEqual(sorted[0].role, 'start');
    assert.strictEqual(sorted[1].role, 'step');
    assert.strictEqual(sorted[2].role, 'step');
    assert.strictEqual(sorted[3].role, 'end');
  });
});