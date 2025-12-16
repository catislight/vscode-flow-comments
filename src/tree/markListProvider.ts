import * as vscode from 'vscode';
import { Graph, Node } from '../models/types';

class MarkItem extends vscode.TreeItem {
  node: Node;
  constructor(n: Node) {
    const label = n.meta?.desc || '（无描述）';
    super(label, vscode.TreeItemCollapsibleState.None);
    this.node = n;
    const parts: string[] = [];
    if (n.meta?.desc) { parts.push(n.meta.desc); }
    parts.push(`${n.file}:${n.line}`);
    this.tooltip = parts.join(' — ');
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

