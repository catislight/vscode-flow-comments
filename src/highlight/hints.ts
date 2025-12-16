import * as vscode from 'vscode';
import { Graph, Node } from '../models/types';
import { prefixIndex } from '../utils/text';

export function applyHintsForFile(filePath: string, nodes: Node[], deco: vscode.TextEditorDecorationType): void {
  const editors = vscode.window.visibleTextEditors.filter(ed => ed.document.uri.fsPath === filePath);
  const cfg = vscode.workspace.getConfiguration('flow');
  const prefix = cfg.get<string>('prefix', 'flow');
  const markPrefix = cfg.get<string>('markPrefix', 'mark');
  for (const ed of editors) {
    const ranges: vscode.Range[] = [];
    for (const n of nodes) {
      const ln = Math.max(n.line - 1, 0);
      if (ln >= 0 && ln < ed.document.lineCount) {
        const textLine = ed.document.lineAt(ln).text;
        if (n.role === 'mark') {
          const i2 = prefixIndex(textLine, markPrefix);
          if (i2 >= 0) {
            const start = new vscode.Position(ln, i2);
            const end = new vscode.Position(ln, i2 + markPrefix.length);
            ranges.push(new vscode.Range(start, end));
          }
        } else {
          const i1 = prefixIndex(textLine, prefix);
          if (i1 >= 0) {
            const start = new vscode.Position(ln, i1);
            const end = new vscode.Position(ln, i1 + prefix.length);
            ranges.push(new vscode.Range(start, end));
          }
        }
      }
    }
    ed.setDecorations(deco, ranges);
  }
}

export function applyHintsForVisibleEditorsFromGraph(graph: Graph, deco: vscode.TextEditorDecorationType): void {
  const editors = vscode.window.visibleTextEditors;
  const cfg = vscode.workspace.getConfiguration('flow');
  const prefix = cfg.get<string>('prefix', 'flow');
  const markPrefix = cfg.get<string>('markPrefix', 'mark');
  const fileMap = new Map<string, Node[]>();
  for (const f of Object.values(graph.features)) {
    for (const n of f.nodes) {
      const arr = fileMap.get(n.file) || [];
      arr.push(n);
      fileMap.set(n.file, arr);
    }
  }
  for (const m of (graph.marks || [])) {
    const arr = fileMap.get(m.file) || [];
    arr.push(m);
    fileMap.set(m.file, arr);
  }
  for (const ed of editors) {
    const file = ed.document.uri.fsPath;
    const ranges: vscode.Range[] = [];
    const nodes = fileMap.get(file) || [];
    for (const n of nodes) {
      const ln = Math.max(n.line - 1, 0);
      if (ln >= 0 && ln < ed.document.lineCount) {
        const textLine = ed.document.lineAt(ln).text;
        if (n.role === 'mark') {
          const i2 = prefixIndex(textLine, markPrefix);
          if (i2 >= 0) {
            const start = new vscode.Position(ln, i2);
            const end = new vscode.Position(ln, i2 + markPrefix.length);
            ranges.push(new vscode.Range(start, end));
          }
        } else {
          const i1 = prefixIndex(textLine, prefix);
          if (i1 >= 0) {
            const start = new vscode.Position(ln, i1);
            const end = new vscode.Position(ln, i1 + prefix.length);
            ranges.push(new vscode.Range(start, end));
          }
        }
      }
    }
    ed.setDecorations(deco, ranges);
  }
}
