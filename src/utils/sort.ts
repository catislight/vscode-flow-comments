import { FeatureGraph, Graph, Node, OrderParts } from '../models/types';

function roleWeight(role: Node['role']): number {
  if (role === 'start') {
    return 0;
  }
  if (role === 'step') {
    return 1;
  }
  return 2;
}

function compareOrder(a?: OrderParts, b?: OrderParts): number {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 0;
  }
  if (!b) {
    return 0;
  }
  const la = a.levels || [];
  const lb = b.levels || [];
  const len = Math.max(la.length, lb.length);
  for (let i = 0; i < len; i++) {
    const ai = la[i];
    const bi = lb[i];
    if (ai === undefined) {
      return -1;
    }
    if (bi === undefined) {
      return 1;
    }
    if (ai !== bi) {
      return ai - bi;
    }
  }
  return 0;
}

export function compareNodes(a: Node, b: Node): number {
  const rw = roleWeight(a.role) - roleWeight(b.role);
  if (rw !== 0) {
    return rw;
  }
  if (a.role === 'step' && b.role === 'step') {
    return compareOrder(a.order, b.order);
  }
  return 0;
}

export function sortFeatureGraph(fg: FeatureGraph): FeatureGraph {
  fg.nodes.sort(compareNodes);
  return fg;
}

export function sortGraph(graph: Graph): Graph {
  Object.values(graph.features).forEach(sortFeatureGraph);
  return graph;
}