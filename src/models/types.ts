export type Role = 'start' | 'step' | 'end' | 'title';

export type OrderKey = string;

export interface OrderParts {
  levels: number[];
}

export interface Meta {
  desc?: string;
  tags?: string[];
  title?: string;
}

export interface Node {
  id: string;
  feature: string;
  role: Role;
  order?: OrderParts;
  file: string;
  line: number;
  meta?: Meta;
}

export interface FeatureIssues {
  missingStart?: boolean;
  missingEnd?: boolean;
  duplicateOrders?: Array<{ order: OrderKey; count: number }>;
}

export interface FeatureGraph {
  feature: string;
  nodes: Node[];
  issues?: FeatureIssues;
}

export interface Graph {
  features: Record<string, FeatureGraph>;
}

export function orderToString(order?: OrderParts): OrderKey {
  if (!order || !order.levels || order.levels.length === 0) {
    return '';
  }
  return order.levels.join('.');
}

export function createNodeId(
  feature: string,
  role: Role,
  order: OrderParts | undefined,
  file: string,
  line: number,
): string {
  const ord = orderToString(order);
  return `${feature}|${role}|${ord}|${file}|${line}`;
}
