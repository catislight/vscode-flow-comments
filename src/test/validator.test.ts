import * as assert from 'assert';
import { createNodeId, FeatureGraph, Node } from '../models/types';
import { computeFeatureIssues } from '../indexer/workspaceIndexer';

suite('Validator', () => {
  test('detect missing and duplicate start/end and duplicate orders', () => {
    const file = '/tmp/v.ts';
    const nodes: Node[] = [
      // missing start initially
      { id: createNodeId('Feat', 'step', { levels: [1] }, file, 2), feature: 'Feat', role: 'step', order: { levels: [1] }, file, line: 2 },
      { id: createNodeId('Feat', 'step', { levels: [1] }, file, 3), feature: 'Feat', role: 'step', order: { levels: [1] }, file, line: 3 },
      { id: createNodeId('Feat', 'end', undefined, file, 99), feature: 'Feat', role: 'end', file, line: 99 },
    ];
    const fg: FeatureGraph = { feature: 'Feat', nodes };
    let issues = computeFeatureIssues(fg);
    assert.strictEqual(issues.missingStart, true);
    assert.strictEqual(issues.missingEnd, false);
    assert.ok(issues.duplicateOrders && issues.duplicateOrders.length === 1);
    assert.strictEqual(issues.duplicateOrders![0].order, '1');
    assert.strictEqual(issues.duplicateOrders![0].count, 2);

    // add another start to cause duplicate start
    nodes.push({ id: createNodeId('Feat', 'start', undefined, file, 1), feature: 'Feat', role: 'start', file, line: 1 });
    nodes.push({ id: createNodeId('Feat', 'start', undefined, file, 10), feature: 'Feat', role: 'start', file, line: 10 });
    issues = computeFeatureIssues(fg);
    assert.strictEqual(issues.missingStart, true); // >1 is considered issue
    // remove end to cause missing end
    fg.nodes = fg.nodes.filter(n => n.role !== 'end');
    issues = computeFeatureIssues(fg);
    assert.strictEqual(issues.missingEnd, true);
  });

  test('ignore steps without order and detect nested duplicate', () => {
    const file = '/tmp/w.ts';
    const nodes: Node[] = [
      { id: createNodeId('X', 'start', undefined, file, 1), feature: 'X', role: 'start', file, line: 1 },
      { id: createNodeId('X', 'step', undefined as any, file, 2), feature: 'X', role: 'step', file, line: 2 },
      { id: createNodeId('X', 'step', { levels: [2,3] }, file, 3), feature: 'X', role: 'step', order: { levels: [2,3] }, file, line: 3 },
      { id: createNodeId('X', 'step', { levels: [2,3] }, file, 4), feature: 'X', role: 'step', order: { levels: [2,3] }, file, line: 4 },
      { id: createNodeId('X', 'end', undefined, file, 99), feature: 'X', role: 'end', file, line: 99 },
    ];
    const fg: FeatureGraph = { feature: 'X', nodes };
    const issues = computeFeatureIssues(fg);
    assert.strictEqual(issues.missingStart, false);
    assert.strictEqual(issues.missingEnd, false);
    assert.ok(issues.duplicateOrders && issues.duplicateOrders.length === 1);
    assert.strictEqual(issues.duplicateOrders![0].order, '2.3');
    assert.strictEqual(issues.duplicateOrders![0].count, 2);
  });
});