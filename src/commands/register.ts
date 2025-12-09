import * as vscode from 'vscode';
import { Graph, Node } from '../models/types';
import { FlowTreeProvider } from '../tree/flowTreeProvider';

type Decos = { highlight: vscode.TextEditorDecorationType; hint: vscode.TextEditorDecorationType };

export function registerCommands(
  context: vscode.ExtensionContext,
  deps: {
    treeProvider: FlowTreeProvider;
    getGraph: () => Graph;
    setGraph: (g: Graph) => void;
    indexCache: { get: (file: string) => { fileHash: string; commentHash: string } | undefined; set: (file: string, v: { fileHash: string; commentHash: string }) => void };
    decorations: Decos;
    applyHintsForFile: (filePath: string, nodes: Node[], deco: vscode.TextEditorDecorationType) => void;
    applyHintsForVisibleEditorsFromGraph: (graph: Graph, deco: vscode.TextEditorDecorationType) => void;
    applyDiagnosticsFromGraph: (graph: Graph) => void;
    parseText: (text: string, file: string, prefix: string) => Node[];
    scanWorkspace: (cache?: any) => Promise<Graph>;
    updateGraphForFile: (graph: Graph, filePath: string, nodes: Node[]) => Graph;
    upsertPersistentEntry: (e: { file: string; fileHash: string; commentHash: string; nodes: Node[] }) => Promise<void> | void;
    hashString: (text: string) => string;
    computeCommentHash: (nodes: Node[]) => string;
  }
) {
  const { treeProvider, getGraph, setGraph, indexCache, decorations, applyHintsForFile, applyHintsForVisibleEditorsFromGraph, applyDiagnosticsFromGraph, parseText, scanWorkspace, updateGraphForFile, upsertPersistentEntry, hashString, computeCommentHash } = deps;


  const reveal = vscode.commands.registerCommand('flow-comments.reveal', async (uri: vscode.Uri, line: number) => {
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: true });
    const pos = new vscode.Position(Math.max(line - 1, 0), 0);
    const range = new vscode.Range(pos, pos);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(pos, pos);
    const lineRange = doc.lineAt(pos.line).range;
    editor.setDecorations(decorations.highlight, [lineRange]);
  });

  const scanActive = vscode.commands.registerCommand('flow-comments.scanActive', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }
    const uri = editor.document.uri.fsPath;
    const cfg = vscode.workspace.getConfiguration('flow');
    const prefix = cfg.get<string>('prefix', 'flow');
    const text = editor.document.getText();
    let nodes: Node[] = [];
    try {
      nodes = parseText(text, uri, prefix);
    } catch {}
    const g = updateGraphForFile(getGraph(), uri, nodes);
    setGraph(g);
    treeProvider.setGraph(g);
    const fileHash = hashString(text);
    const commentHash = computeCommentHash(nodes);
    void upsertPersistentEntry({ file: uri, fileHash, commentHash, nodes });
    vscode.window.showInformationMessage(`Flow Comments: parsed ${nodes.length} node(s) from active file`);
    applyHintsForFile(uri, nodes, decorations.hint);
    applyDiagnosticsFromGraph(getGraph());
  });

  const refresh = vscode.commands.registerCommand('flow-comments.refresh', async () => {
    const graph = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: 'Flow Comments: Indexing' }, async () => {
      return await scanWorkspace(indexCache as any);
    });
    treeProvider.setGraph(graph);
    setGraph(graph);
    applyHintsForVisibleEditorsFromGraph(graph, decorations.hint);
    applyDiagnosticsFromGraph(graph);
  });

  const deleteFeature = vscode.commands.registerCommand('flow-comments.deleteFeature', async (item: any) => {
    try {
      const ti = item as { kind?: string; feature?: string };
      if (!ti || ti.kind !== 'feature' || !ti.feature) {
        vscode.window.showWarningMessage('只能删除 feature 项');
        return;
      }
      const feature = ti.feature;
      const graph = getGraph();
      const fg = graph.features[feature];
      if (!fg) {
        vscode.window.showWarningMessage(`未找到 flow：${feature}`);
        return;
      }
      const choice = await vscode.window.showWarningMessage(`确认删除 flow “${feature}” 的所有标记？该操作将移除所有相关注释行。`, { modal: true }, '删除');
      if (choice !== '删除') { return; }

      const byFile = new Map<string, number[]>();
      for (const n of fg.nodes) {
        const arr = byFile.get(n.file) || [];
        arr.push(Math.max(n.line - 1, 0));
        byFile.set(n.file, arr);
      }

      const edit = new vscode.WorkspaceEdit();
      for (const [file, lines] of byFile.entries()) {
        const uri = vscode.Uri.file(file);
        const doc = await vscode.workspace.openTextDocument(uri);
        const sorted = lines.sort((a, b) => b - a);
        for (const ln of sorted) {
          const full = doc.lineAt(Math.min(Math.max(ln, 0), doc.lineCount - 1)).rangeIncludingLineBreak;
          edit.delete(uri, full);
        }
      }
      const ok = await vscode.workspace.applyEdit(edit);
      if (!ok) {
        vscode.window.showErrorMessage('删除失败：无法应用编辑');
        return;
      }

      // 保存相关文件并增量更新图
      for (const file of byFile.keys()) {
        const doc = vscode.workspace.textDocuments.find(td => td.uri.fsPath === file) || await vscode.workspace.openTextDocument(vscode.Uri.file(file));
        await doc.save();
        const cfg = vscode.workspace.getConfiguration('flow');
        const prefix = cfg.get<string>('prefix', 'flow');
        const text = doc.getText();
        let nodes: Node[] = [];
        try { nodes = parseText(text, file, prefix); } catch {}
        const g2 = updateGraphForFile(getGraph(), file, nodes);
        setGraph(g2);
      }
      treeProvider.setGraph(getGraph());
      applyHintsForVisibleEditorsFromGraph(getGraph(), decorations.hint);
      applyDiagnosticsFromGraph(getGraph());
      vscode.window.showInformationMessage(`已删除 flow “${feature}”。`);
    } catch (err) {
      vscode.window.showErrorMessage(`删除失败：${String(err)}`);
    }
  });

  const deleteNode = vscode.commands.registerCommand('flow-comments.deleteNode', async (item: any) => {
    try {
      const ti = item as { node?: Node; kind?: string; feature?: string };
      const n = ti?.node;
      if (!n) {
        vscode.window.showWarningMessage('只能删除具体节点项');
        return;
      }
      const choice = await vscode.window.showWarningMessage(`确认删除该注释行（${n.file}:${n.line}）？`, { modal: true }, '删除');
      if (choice !== '删除') { return; }
      const uri = vscode.Uri.file(n.file);
      const doc = await vscode.workspace.openTextDocument(uri);
      const ln0 = Math.max(n.line - 1, 0);
      const range = doc.lineAt(Math.min(Math.max(ln0, 0), doc.lineCount - 1)).rangeIncludingLineBreak;
      const edit = new vscode.WorkspaceEdit();
      edit.delete(uri, range);
      const ok = await vscode.workspace.applyEdit(edit);
      if (!ok) { vscode.window.showErrorMessage('删除失败：无法应用编辑'); return; }
      await doc.save();

      const cfg = vscode.workspace.getConfiguration('flow');
      const prefix = cfg.get<string>('prefix', 'flow');
      const text = doc.getText();
      let nodes: Node[] = [];
      try { nodes = parseText(text, n.file, prefix); } catch {}
      const g2 = updateGraphForFile(getGraph(), n.file, nodes);
      setGraph(g2);
      treeProvider.setGraph(g2);
      applyHintsForVisibleEditorsFromGraph(g2, decorations.hint);
      applyDiagnosticsFromGraph(g2);
      vscode.window.showInformationMessage('节点已删除');
    } catch (err) {
      vscode.window.showErrorMessage(`删除失败：${String(err)}`);
    }
  });

  context.subscriptions.push(reveal, scanActive, refresh, deleteFeature, deleteNode);
}