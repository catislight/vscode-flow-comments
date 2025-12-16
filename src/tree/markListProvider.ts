import * as vscode from 'vscode';
import * as path from 'path';
import { Graph, Node } from '../models/types';

class MarkItem extends vscode.TreeItem {
  node: Node;
  constructor(n: Node) {
    const cfg = vscode.workspace.getConfiguration('flow');
    const wf = vscode.workspace.workspaceFolders;
    const root = wf && wf.length ? wf[0].uri.fsPath : undefined;
    const rel = root ? path.relative(root, n.file) || n.file : n.file;
    const levels = Math.max(1, cfg.get<number>('markPathLevels', 2));
    const segments = rel.split(/[\\/]+/).filter(Boolean);
    const showParts = segments.slice(Math.max(segments.length - levels, 0));
    const shortPath = `${showParts.join('/')}`;
    const label = n.meta?.desc || `${shortPath}:${n.line}`;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.node = n;
    const tooltipParts: string[] = [];
    if (n.meta?.desc) { tooltipParts.push(n.meta.desc); }
    tooltipParts.push(`${shortPath}:${n.line}`);
    this.tooltip = tooltipParts.join(' — ');
    this.command = {
      command: 'flow-comments.reveal',
      title: 'Reveal',
      arguments: [vscode.Uri.file(n.file), n.line, { role: 'mark', desc: n.meta?.desc }]
    };
    this.contextValue = 'flowMarkNode';
  }
}

export class MarkListProvider implements vscode.TreeDataProvider<MarkItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MarkItem | undefined | null | void> = new vscode.EventEmitter<MarkItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MarkItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private graph: Graph = { features: {}, marks: [] };

  setGraph(graph: Graph): void {
    this.graph = graph;
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MarkItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: MarkItem): vscode.ProviderResult<MarkItem[]> {
    if (element) { return []; }
    const marks = (this.graph.marks || []).slice();
    marks.sort((a, b) => {
      const da = a.meta?.desc || '';
      const db = b.meta?.desc || '';
      if (da !== db) { return da.localeCompare(db); }
      if (a.file !== b.file) { return a.file.localeCompare(b.file); }
      return a.line - b.line;
    });
    return marks.map(n => new MarkItem(n));
  }
}
