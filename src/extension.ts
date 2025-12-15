// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Graph, Node } from './models/types';
import { scanWorkspace, updateGraphForFile } from './indexer/workspaceIndexer';
import { IndexCache, computeCommentHash, hashString, upsertPersistentEntry, removePersistentEntries } from './indexer/cache';
import { FlowTreeProvider } from './tree/flowTreeProvider';
import { logger } from './utils/logger';
import { buildDecorations } from './highlight/decorations';
import { applyDiagnosticsFromGraph } from './diagnostics/apply';
import { applyHintsForFile, applyHintsForVisibleEditorsFromGraph } from './highlight/hints';
import { parser, indexer } from './services/api';
import { registerCommands } from './commands/register';
import { pinyin } from 'pinyin-pro';
import { registerCompletionProvider } from './completion/provider';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const treeProvider = new FlowTreeProvider();
    let currentGraph: Graph = { features: {} };
    const debounceTimers = new Map<string, NodeJS.Timeout>();
    const indexCache = new IndexCache();
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('flow-comments');
    const cfg0 = vscode.workspace.getConfiguration('flow');

    let decoPair = buildDecorations();
    let highlightDecoration = decoPair.highlight;
    let hintDecoration = decoPair.hint;

    vscode.window.registerTreeDataProvider('flowNavTree', treeProvider);
    vscode.window.createTreeView('flowNavTree', { treeDataProvider: treeProvider });
    registerCommands(context, {
        treeProvider,
        getGraph: () => currentGraph,
        setGraph: (g: Graph) => { currentGraph = g; },
        indexCache,
        decorations: { highlight: highlightDecoration, hint: hintDecoration },
        applyHintsForFile,
        applyHintsForVisibleEditorsFromGraph,
        applyDiagnosticsFromGraph: (g: Graph) => applyDiagnosticsFromGraph(g, diagnosticCollection),
        parseText: parser.parseText,
        scanWorkspace: indexer.scanWorkspace,
        updateGraphForFile: indexer.updateGraphForFile,
        upsertPersistentEntry,
        hashString,
        computeCommentHash,
    });

    const onCfg = vscode.workspace.onDidChangeConfiguration((e) => {
        if (
            e.affectsConfiguration('flow.highlightBackground') ||
            e.affectsConfiguration('flow.highlightColor') ||
            e.affectsConfiguration('flow.tokenBackground') ||
            e.affectsConfiguration('flow.tokenColor') ||
            e.affectsConfiguration('flow.hintBackground') ||
            false
        ) {
            highlightDecoration.dispose();
            hintDecoration.dispose();
            decoPair = buildDecorations();
            highlightDecoration = decoPair.highlight;
            hintDecoration = decoPair.hint;
            applyHintsForVisibleEditorsFromGraph(currentGraph, hintDecoration);
        }
    });
    context.subscriptions.push(onCfg);
    const onTheme = vscode.window.onDidChangeActiveColorTheme(() => {
        highlightDecoration.dispose();
        hintDecoration.dispose();
        decoPair = buildDecorations();
        highlightDecoration = decoPair.highlight;
        hintDecoration = decoPair.hint;
        applyHintsForVisibleEditorsFromGraph(currentGraph, hintDecoration);
        applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
    });
    context.subscriptions.push(onTheme);

    // deprecated: individual hint cfg listener merged into onCfg above

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: 'Flow Comments: Indexing',
    }, async () => {
        const graph = await scanWorkspace(indexCache);
        treeProvider.setGraph(graph);
        currentGraph = graph;
        if (!Object.keys(currentGraph.features).length) {
            setTimeout(async () => {
                const g2 = await scanWorkspace(indexCache);
                treeProvider.setGraph(g2);
                currentGraph = g2;
            }, 100);
        }
        applyHintsForVisibleEditorsFromGraph(currentGraph, hintDecoration);
        applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
    });

    // 增量更新：监听文档编辑事件，实时解析并更新图、装饰与诊断
    const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
        const uri = e.document.uri.fsPath;
        // 编辑发生时，清除该文档的行高亮，避免删除后残留
        for (const ed of vscode.window.visibleTextEditors) {
            if (ed.document.uri.fsPath === uri) {
                ed.setDecorations(highlightDecoration, []);
            }
        }
        const cfg = vscode.workspace.getConfiguration('flow');
        const prefix = cfg.get<string>('prefix', 'flow');
        const text = e.document.getText();
        let nodes: Node[] = [];
        try {
            nodes = parser.parseText(text, uri, prefix);
        } catch (err) {
            logger.error('parse on change failed', err);
        }
        const newCommentHash = computeCommentHash(nodes);
        const cachedBefore = indexCache.get(uri);
        currentGraph = updateGraphForFile(currentGraph, uri, nodes);
        indexCache.set(uri, { fileHash: hashString(text), commentHash: newCommentHash });
        treeProvider.setGraph(currentGraph);
        applyHintsForFile(uri, nodes, hintDecoration);
        if (!cachedBefore || cachedBefore.commentHash !== newCommentHash) {
            void upsertPersistentEntry({ file: uri, fileHash: hashString(text), commentHash: newCommentHash, nodes });
        }
        applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
    });
    // 保存事件：立即重建该文件的节点并更新图
    const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
        const uri = doc.uri.fsPath;
        const cfg = vscode.workspace.getConfiguration('flow');
        const prefix = cfg.get<string>('prefix', 'flow');
        const text = doc.getText();
        let nodes: Node[] = [];
        try {
            nodes = parser.parseText(text, uri, prefix);
        } catch (err) {
            logger.error('parse on save failed', err);
        }
        const newCommentHash = computeCommentHash(nodes);
        const cached = indexCache.get(uri);
        if (!cached || cached.commentHash !== newCommentHash) {
            currentGraph = updateGraphForFile(currentGraph, uri, nodes);
            indexCache.set(uri, { fileHash: hashString(text), commentHash: newCommentHash });
        }
        treeProvider.setGraph(currentGraph);
        applyHintsForFile(uri, nodes, hintDecoration);
        if (!cached || cached.commentHash !== newCommentHash) {
            void upsertPersistentEntry({ file: uri, fileHash: hashString(text), commentHash: newCommentHash, nodes });
        }
        applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
    });
    // 打开文档事件：在冷启动阶段及时解析新打开的文件以填充视图
    const onOpen = vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.uri.scheme !== 'file') { return; }
        const uri = doc.uri.fsPath;
        const cfg = vscode.workspace.getConfiguration('flow');
        const prefix = cfg.get<string>('prefix', 'flow');
        const text = doc.getText();
        let nodes: Node[] = [];
        try {
            nodes = parser.parseText(text, uri, prefix);
        } catch (err) {
            logger.error('parse on open failed', err);
        }
        const newCommentHash = computeCommentHash(nodes);
        const cached = indexCache.get(uri);
        if (cached && cached.commentHash === newCommentHash) {
            return;
        }
        currentGraph = updateGraphForFile(currentGraph, uri, nodes);
        indexCache.set(uri, { fileHash: hashString(text), commentHash: newCommentHash });
        treeProvider.setGraph(currentGraph);
        applyHintsForFile(uri, nodes, hintDecoration);
        void upsertPersistentEntry({ file: uri, fileHash: hashString(text), commentHash: newCommentHash, nodes });
        applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
    });
    context.subscriptions.push(onChange, onSave, onOpen);
    const onEditors = vscode.window.onDidChangeVisibleTextEditors(() => {
        applyHintsForVisibleEditorsFromGraph(currentGraph, hintDecoration);
        applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
    });
    context.subscriptions.push(onEditors);

    const onRename = vscode.workspace.onDidRenameFiles(async (e) => {
        try {
            for (const f of e.files) {
                const oldPath = f.oldUri.fsPath;
                const newPath = f.newUri.fsPath;
                try {
                    const buf = await vscode.workspace.fs.readFile(f.newUri);
                    const text = new TextDecoder('utf-8').decode(buf);
                    const cfg = vscode.workspace.getConfiguration('flow');
                    const prefix = cfg.get<string>('prefix', 'flow');
                    let nodes: Node[] = [];
                    try { nodes = parser.parseText(text, newPath, prefix); } catch {}
                    currentGraph = updateGraphForFile(currentGraph, oldPath, []);
                    currentGraph = updateGraphForFile(currentGraph, newPath, nodes);
                    indexCache.set(newPath, { fileHash: hashString(text), commentHash: computeCommentHash(nodes) });
                    treeProvider.setGraph(currentGraph);
                    applyHintsForFile(newPath, nodes, hintDecoration);
                    await upsertPersistentEntry({ file: newPath, fileHash: hashString(text), commentHash: computeCommentHash(nodes), nodes });
                    await removePersistentEntries([oldPath]);
                } catch {}
            }
            applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
        } catch {}
    });
    context.subscriptions.push(onRename);

    const onDelete = vscode.workspace.onDidDeleteFiles(async (e) => {
        try {
            const files = e.files.map(u => u.fsPath);
            for (const file of files) {
                currentGraph = updateGraphForFile(currentGraph, file, []);
            }
            treeProvider.setGraph(currentGraph);
            await removePersistentEntries(files);
            applyHintsForVisibleEditorsFromGraph(currentGraph, hintDecoration);
            applyDiagnosticsFromGraph(currentGraph, diagnosticCollection);
        } catch {}
    });
    context.subscriptions.push(onDelete);

    registerCompletionProvider(context, () => currentGraph);
}

// This method is called when your extension is deactivated
export function deactivate() {}
