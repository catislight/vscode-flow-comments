import * as vscode from 'vscode';
import { Graph, Node, OrderParts } from '../models/types';

type Kind = 'feature' | 'start' | 'end' | 'level';

class FlowTreeItem extends vscode.TreeItem {
  kind: Kind;
  feature: string;
  order?: OrderParts;
  node?: Node;
  isVirtual?: boolean;
  path?: number[];
  depth?: number;
  constructor(label: string, kind: Kind, feature: string, collapsible?: vscode.TreeItemCollapsibleState) {
    super(label, collapsible);
    this.kind = kind;
    this.feature = feature;
  }
}

export class FlowTreeProvider implements vscode.TreeDataProvider<FlowTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private graph: Graph | null = null;

  setGraph(graph: Graph): void {
    this.graph = graph;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FlowTreeItem): vscode.TreeItem { return element; }

  getChildren(element?: FlowTreeItem): Thenable<FlowTreeItem[]> {
    if (!this.graph || Object.keys(this.graph.features).length === 0) {
      if (!element) {
        return Promise.resolve([new FlowTreeItem('No data yet', 'feature', '', vscode.TreeItemCollapsibleState.None)]);
      }
      return Promise.resolve([]);
    }
    if (!element) {
      const items: FlowTreeItem[] = [];
      for (const [feature, fg] of Object.entries(this.graph.features)) {
        const item = new FlowTreeItem(feature, 'feature', feature, vscode.TreeItemCollapsibleState.Collapsed);
        item.description = `${fg.nodes.length}`;
        item.contextValue = 'flowFeature';
        items.push(item);
      }
      return Promise.resolve(items);
    }
    const featureGraph = this.graph.features[element.feature];
    if (!featureGraph) {
      return Promise.resolve([]);
    }

    if (element.kind === 'feature') {
      const nodes = featureGraph.nodes;
      const res: FlowTreeItem[] = [];
      // start
      for (const n of nodes) {
        if (n.role === 'start') {
          const label = `start${labelFromDesc(n)}`;
          const ti = new FlowTreeItem(label, 'start', element.feature, vscode.TreeItemCollapsibleState.None);
          ti.node = n;
          ti.tooltip = buildTooltip(n);
          ti.command = buildRevealCommand(n);
          ti.contextValue = 'flowStart';
          res.push(ti);
        }
      }
      // level-1 groups
      const lv1 = new Map<number, Node[]>();
      for (const n of nodes) {
        const levels = n.order?.levels || [];
        if (n.role === 'step' && levels.length > 0) {
          const k = levels[0];
          const arr = lv1.get(k) || [];
          arr.push(n);
          lv1.set(k, arr);
        }
      }
      for (const [k, arr] of Array.from(lv1.entries()).sort((a, b) => a[0] - b[0])) {
        const pure = arr.find(n => (n.order?.levels?.length || 0) === 1);
        const hasChildren = arr.some(n => (n.order?.levels?.length || 0) > 1);
        const labelBase = `${k}`;
        const label = pure ? `${labelBase}${labelFromDesc(pure)}` : `${labelBase}`;
        const ti = new FlowTreeItem(label, 'level', element.feature, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        ti.path = [k];
        ti.depth = 1;
        ti.node = pure;
        if (pure) {
          ti.tooltip = buildTooltip(pure);
          ti.command = buildRevealCommand(pure);
          ti.contextValue = 'flowNode';
        }
        res.push(ti);
      }
      // end
      for (const n of nodes) {
        if (n.role === 'end') {
          const label = `end${labelFromDesc(n)}`;
          const ti = new FlowTreeItem(label, 'end', element.feature, vscode.TreeItemCollapsibleState.None);
          ti.node = n;
          ti.tooltip = buildTooltip(n);
          ti.command = buildRevealCommand(n);
          ti.contextValue = 'flowEnd';
          res.push(ti);
        }
      }
      return Promise.resolve(res);
    }

    if (element.kind === 'level') {
      const res: FlowTreeItem[] = [];
      const path = element.path || [];
      const nodes = featureGraph.nodes.filter(n => n.role === 'step' && (n.order?.levels?.length || 0) >= path.length && path.every((v, i) => n.order!.levels[i] === v));
      const nextGroups = new Map<number, Node[]>();
      for (const n of nodes) {
        const lvls = n.order!.levels;
        if (lvls.length > path.length) {
          const next = lvls[path.length];
          const arr = nextGroups.get(next) || [];
          arr.push(n);
          nextGroups.set(next, arr);
        }
      }
      for (const [next, arr] of Array.from(nextGroups.entries()).sort((a, b) => a[0] - b[0])) {
        const childPath = [...path, next];
        const pure = arr.find(n => (n.order!.levels.length) === childPath.length);
        const hasChildren = arr.some(n => n.order!.levels.length > childPath.length);
        const labelBase = childPath.join('.');
        const label = pure ? `${labelBase}${labelFromDesc(pure)}` : `${labelBase}`;
        const ti = new FlowTreeItem(label, 'level', element.feature, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        ti.path = childPath;
        ti.depth = (element.depth || path.length) + 1;
        ti.node = pure || undefined;
        if (pure) {
          ti.tooltip = buildTooltip(pure);
          ti.command = buildRevealCommand(pure);
          ti.contextValue = 'flowNode';
        }
        res.push(ti);
      }
      return Promise.resolve(res);
    }

    return Promise.resolve([]);
  }
}

function labelFromDesc(n: Node): string {
  return n.meta?.desc ? ` ${n.meta?.desc}` : '';
}

function buildTooltip(n: Node): string {
  const parts: string[] = [];
  const title = n.role === 'step' ? (n.order && n.order.levels ? n.order.levels.join('.') : '') : n.role;
  parts.push(title);
  if (n.meta?.desc) {
    parts.push(n.meta.desc);
  }
  parts.push(`${n.file}:${n.line}`);
  return parts.join(' — ');
}

function buildRevealCommand(n: Node): vscode.Command {
  const uri = vscode.Uri.file(n.file);
  return {
    command: 'flow-comments.reveal',
    title: 'Reveal',
    arguments: [uri, n.line, { feature: n.feature, role: n.role, order: n.order?.levels || [] }]
  };
}
