import * as vscode from 'vscode';
import { Graph, Node, OrderParts } from '../models/types';

type Kind = 'feature' | 'subFeature' | 'start' | 'end' | 'level' | 'titleGroup' | 'titleItem';

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
      const baseMap = new Map<string, number>();
      for (const [feature, fg] of Object.entries(this.graph.features)) {
        const base = feature.split('-')[0];
        const prev = baseMap.get(base) || 0;
        baseMap.set(base, prev + fg.nodes.length);
      }
      for (const [base, count] of Array.from(baseMap.entries())) {
        const item = new FlowTreeItem(base, 'feature', base, vscode.TreeItemCollapsibleState.Collapsed);
        item.description = `${count}`;
        item.contextValue = 'flowFeature';
        items.push(item);
      }
      return Promise.resolve(items);
    }
    const allNodes: Node[] = [];
    for (const [name, fg] of Object.entries(this.graph.features)) {
      if (name === element.feature || name.startsWith(`${element.feature}-`)) {
        allNodes.push(...fg.nodes);
      }
    }
    allNodes.sort((a, b) => a.line - b.line);

    if (element.kind === 'feature') {
      const nodes = allNodes;
      const res: FlowTreeItem[] = [];
      const baseNodes = nodes.filter(n => n.feature === element.feature);
      const subNames = new Set<string>();
      for (const n of nodes) {
        const parts = n.feature.split('-');
        if (parts.length >= 2 && parts[0] === element.feature) {
          subNames.add(parts.slice(1).join('-'));
        }
      }
      const lv1 = new Map<number, Node[]>();
      for (const n of baseNodes) {
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
      for (const sub of Array.from(subNames).sort()) {
        const ti = new FlowTreeItem(sub, 'subFeature', `${element.feature}-${sub}`, vscode.TreeItemCollapsibleState.Collapsed);
        res.push(ti);
      }
      // title groups（非序号标题语法）：按标题折叠
      const titleMap = new Map<string, Node[]>();
      for (const n of nodes) {
        if (n.role === 'title') {
          const name = (n.meta?.title || '未命名标题');
          const arr = titleMap.get(name) || [];
          arr.push(n);
          titleMap.set(name, arr);
        }
      }
      for (const [name, arr] of Array.from(titleMap.entries())) {
        const ti = new FlowTreeItem(name, 'titleGroup', element.feature, vscode.TreeItemCollapsibleState.Collapsed);
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
      // unordered steps (no levels) — only base feature, place at bottom
      for (const n of baseNodes) {
        if (n.role === 'step' && (!n.order || !n.order.levels || n.order.levels.length === 0)) {
          const label = n.meta?.desc || '（无描述）';
          const ti = new FlowTreeItem(label, 'level', element.feature, vscode.TreeItemCollapsibleState.None);
          ti.node = n;
          ti.tooltip = buildTooltip(n);
          ti.command = buildRevealCommand(n);
          ti.contextValue = 'flowNode';
          res.push(ti);
        }
      }
      return Promise.resolve(res);
    }

    if (element.kind === 'subFeature') {
      const nodes = allNodes.filter(n => n.feature === element.feature);
      const res: FlowTreeItem[] = [];
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
      // unordered steps (no levels) — place at bottom within subFeature
      for (const n of nodes) {
        if (n.role === 'step' && (!n.order || !n.order.levels || n.order.levels.length === 0)) {
          const label = n.meta?.desc || '（无描述）';
          const ti = new FlowTreeItem(label, 'level', element.feature, vscode.TreeItemCollapsibleState.None);
          ti.node = n;
          ti.tooltip = buildTooltip(n);
          ti.command = buildRevealCommand(n);
          ti.contextValue = 'flowNode';
          res.push(ti);
        }
      }
      return Promise.resolve(res);
    }

    if (element.kind === 'level') {
      const res: FlowTreeItem[] = [];
      const path = element.path || [];
      const nodes = allNodes.filter(n => n.role === 'step' && (n.order?.levels?.length || 0) >= path.length && path.every((v, i) => n.order!.levels[i] === v));
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

    if (element.kind === 'titleGroup') {
      const res: FlowTreeItem[] = [];
      const groupName = element.label || '';
      const nodes = allNodes.filter(n => n.role === 'title' && (n.meta?.title || '未命名标题') === groupName);
      for (const n of nodes) {
        const label = buildTitleItemLabel(n);
        const ti = new FlowTreeItem(label, 'titleItem', element.feature, vscode.TreeItemCollapsibleState.None);
        ti.node = n;
        ti.tooltip = buildTooltip(n);
        ti.command = buildRevealCommand(n);
        ti.contextValue = 'flowNode';
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

function buildTitleItemLabel(n: Node): string {
  const desc = n.meta?.desc || '（无描述）';
  return `${desc}`;
}

function buildTooltip(n: Node): string {
  const parts: string[] = [];
  const title = n.role === 'step' ? (n.order && n.order.levels ? n.order.levels.join('.') : '') : (n.role === 'title' ? '标题' : n.role);
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
