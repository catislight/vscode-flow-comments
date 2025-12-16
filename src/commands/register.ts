import * as vscode from 'vscode';
import { Graph, Node, orderToString } from '../models/types';
import { FlowTreeProvider } from '../tree/flowTreeProvider';

type Decos = { highlight: vscode.TextEditorDecorationType; hint: vscode.TextEditorDecorationType };

export function registerCommands(
  context: vscode.ExtensionContext,
  deps: {
    treeProvider: FlowTreeProvider;
    markProvider: { setGraph: (g: Graph) => void };
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
  const { treeProvider, markProvider, getGraph, setGraph, indexCache, decorations, applyHintsForFile, applyHintsForVisibleEditorsFromGraph, applyDiagnosticsFromGraph, parseText, scanWorkspace, updateGraphForFile, upsertPersistentEntry, hashString, computeCommentHash } = deps;


  const reveal = vscode.commands.registerCommand('flow-comments.reveal', async (uri: vscode.Uri, line: number, meta?: { feature?: string; role?: string; order?: number[]; desc?: string }) => {
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      const graph = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: 'Flow Comments: Rescanning (file moved?)' }, async () => {
        return await scanWorkspace(indexCache as any);
      });
      treeProvider.setGraph(graph);
      markProvider.setGraph(graph);
      setGraph(graph);
      const role = (meta?.role as any) || undefined;
      let candidate: Node | undefined;
      if (role === 'mark') {
        const desc = meta?.desc || '';
        candidate = (graph.marks || []).find(n => (n.meta?.desc || '') === desc) || undefined;
      } else {
        const feature = meta?.feature || '';
        const ordStr = (meta?.order && meta.order.length) ? meta.order.join('.') : '';
        const fg = feature ? graph.features[feature] : undefined;
        if (fg) {
          candidate = fg.nodes.find(n => (!role || n.role === role) && orderToString(n.order) === ordStr) || fg.nodes.find(n => n.role === 'start');
        }
      }
      if (candidate) {
        uri = vscode.Uri.file(candidate.file);
        line = candidate.line;
      } else {
        vscode.window.showWarningMessage('文件路径已变更且未找到匹配节点，索引已刷新。');
        return;
      }
    }
    let doc: vscode.TextDocument;
    try {
      doc = await vscode.workspace.openTextDocument(uri);
    } catch (e) {
      vscode.window.showErrorMessage(`无法打开文件：${uri.fsPath}`);
      return;
    }
    let editor: vscode.TextEditor;
    try {
      editor = await vscode.window.showTextDocument(doc, { preview: true });
    } catch (e) {
      vscode.window.showErrorMessage('无法显示目标文件');
      return;
    }
    const safeLine = Math.max(0, Math.min(line - 1, doc.lineCount - 1));
    const pos = new vscode.Position(safeLine, 0);
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
    markProvider.setGraph(graph);
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
      const missingFiles: string[] = [];
      for (const [file, lines] of byFile.entries()) {
        const uri = vscode.Uri.file(file);
        try {
          await vscode.workspace.fs.stat(uri);
        } catch {
          missingFiles.push(file);
          continue;
        }
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
      for (const ed of vscode.window.visibleTextEditors) {
        ed.setDecorations(decorations.highlight, []);
      }
      const suffix = missingFiles.length ? `（缺失文件 ${missingFiles.length} 个已跳过）` : '';
      vscode.window.showInformationMessage(`已删除 flow “${feature}”。${suffix}`);
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
      const graph = getGraph();
      const fg = graph.features[n.feature];
      const targetsByFile = new Map<string, number[]>();
      function pushDel(file: string, ln1based: number) {
        const arr = targetsByFile.get(file) || [];
        arr.push(Math.max(ln1based - 1, 0));
        targetsByFile.set(file, arr);
      }
      pushDel(n.file, n.line);
      if (n.role === 'step' && n.order && n.order.levels && n.order.levels.length) {
        const key = n.order.levels.join('.');
        for (const m of fg?.nodes || []) {
          if (m === n) { continue; }
          if (m.order && m.order.levels && m.order.levels.length) {
            const mk = m.order.levels.join('.');
            if (mk === key || mk.startsWith(`${key}.`)) {
              pushDel(m.file, m.line);
            }
          }
        }
      }
      const edit = new vscode.WorkspaceEdit();
      for (const [file, lines] of targetsByFile.entries()) {
        const uri = vscode.Uri.file(file);
        try { await vscode.workspace.fs.stat(uri); } catch { continue; }
        const doc = await vscode.workspace.openTextDocument(uri);
        const sorted = Array.from(new Set(lines)).sort((a,b)=>b-a);
        for (const ln of sorted) {
          const full = doc.lineAt(Math.min(Math.max(ln, 0), doc.lineCount - 1)).rangeIncludingLineBreak;
          edit.delete(uri, full);
        }
      }
      const ok = await vscode.workspace.applyEdit(edit);
      if (!ok) { vscode.window.showErrorMessage('删除失败：无法应用编辑'); return; }
      // 保存所有已编辑文档
      for (const [file] of targetsByFile.entries()) {
        try {
          const du = vscode.Uri.file(file);
          const doc2 = await vscode.workspace.openTextDocument(du);
          await doc2.save();
        } catch {}
      }

      const cfg = vscode.workspace.getConfiguration('flow');
      const prefix = cfg.get<string>('prefix', 'flow');
      // 逐文件重新解析并增量更新图
      let g2 = getGraph();
      for (const [file] of targetsByFile.entries()) {
        try {
          const du = vscode.Uri.file(file);
          const doc3 = await vscode.workspace.openTextDocument(du);
          const text3 = doc3.getText();
          let nodes3: Node[] = [];
          try { nodes3 = parseText(text3, file, prefix); } catch {}
          g2 = updateGraphForFile(g2, file, nodes3);
        } catch {}
      }
      setGraph(g2);
      treeProvider.setGraph(g2);
      applyHintsForVisibleEditorsFromGraph(g2, decorations.hint);
      applyDiagnosticsFromGraph(g2);
      for (const ed of vscode.window.visibleTextEditors) {
        ed.setDecorations(decorations.highlight, []);
      }
      vscode.window.showInformationMessage('节点及其子步骤已删除');
    } catch (err) {
      vscode.window.showErrorMessage(`删除失败：${String(err)}`);
    }
  });

  context.subscriptions.push(reveal, scanActive, refresh, deleteFeature, deleteNode);
}
