import * as vscode from 'vscode';
import { Graph, Node } from '../models/types';
import { prefixIndex } from '../utils/text';

export function applyHintsForFile(filePath: string, nodes: Node[], deco: vscode.TextEditorDecorationType): void {
  const editors = vscode.window.visibleTextEditors.filter(ed => ed.document.uri.fsPath === filePath);
  const prefix = vscode.workspace.getConfiguration('flow').get<string>('prefix', 'flow');
  for (const ed of editors) {
    const ranges: vscode.Range[] = [];
    for (const n of nodes) {
      const ln = Math.max(n.line - 1, 0);
      if (ln >= 0 && ln < ed.document.lineCount) {
        const textLine = ed.document.lineAt(ln).text;
        const idx = prefixIndex(textLine, prefix);
        if (idx >= 0) {
          const start = new vscode.Position(ln, idx);
          const end = new vscode.Position(ln, idx + prefix.length);
          ranges.push(new vscode.Range(start, end));
        }
      }
    }
    ed.setDecorations(deco, ranges);
  }
}

export function applyHintsForVisibleEditorsFromGraph(graph: Graph, deco: vscode.TextEditorDecorationType): void {
  const editors = vscode.window.visibleTextEditors;
  const prefix = vscode.workspace.getConfiguration('flow').get<string>('prefix', 'flow');
  const fileMap = new Map<string, Node[]>();
  for (const f of Object.values(graph.features)) {
    for (const n of f.nodes) {
      const arr = fileMap.get(n.file) || [];
      arr.push(n);
      fileMap.set(n.file, arr);
    }
  }
  for (const ed of editors) {
    const file = ed.document.uri.fsPath;
    const ranges: vscode.Range[] = [];
    const nodes = fileMap.get(file) || [];
    for (const n of nodes) {
      const ln = Math.max(n.line - 1, 0);
      if (ln >= 0 && ln < ed.document.lineCount) {
        const textLine = ed.document.lineAt(ln).text;
        const idx = prefixIndex(textLine, prefix);
        if (idx >= 0) {
          const start = new vscode.Position(ln, idx);
          const end = new vscode.Position(ln, idx + prefix.length);
          ranges.push(new vscode.Range(start, end));
        }
      }
    }
    ed.setDecorations(deco, ranges);
  }
}