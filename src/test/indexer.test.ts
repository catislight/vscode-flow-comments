import * as assert from 'assert';
import { Graph, createNodeId, Node } from '../models/types';
import { updateGraphForFile } from '../indexer/workspaceIndexer';

suite('Indexer updateGraphForFile', () => {
  test('recomputes issues after file update', () => {
    const file = '/tmp/u.ts';
    const g: Graph = { features: { F: { feature: 'F', nodes: [
      { id: createNodeId('F', 'start', undefined, file, 1), feature: 'F', role: 'start', file, line: 1 },
      { id: createNodeId('F', 'end', undefined, file, 2), feature: 'F', role: 'end', file, line: 2 },
    ] } } };
    // update: remove start, add two steps with same order
    const nodes: Node[] = [
      { id: createNodeId('F', 'step', { levels: [1] }, file, 10), feature: 'F', role: 'step', order: { levels: [1] }, file, line: 10 },
      { id: createNodeId('F', 'step', { levels: [1] }, file, 11), feature: 'F', role: 'step', order: { levels: [1] }, file, line: 11 },
      { id: createNodeId('F', 'end', undefined, file, 99), feature: 'F', role: 'end', file, line: 99 },
    ];
    const g2 = updateGraphForFile(g, file, nodes);
    const issues = g2.features['F'].issues!;
    assert.strictEqual(issues.missingStart, true);
    assert.strictEqual(issues.missingEnd, false);
    assert.ok(issues.duplicateOrders && issues.duplicateOrders.length === 1);
    assert.strictEqual(issues.duplicateOrders![0].order, '1');
  });
});
