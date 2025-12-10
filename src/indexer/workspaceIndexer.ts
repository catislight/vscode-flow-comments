import * as vscode from 'vscode';
import { Graph, FeatureGraph, Node, orderToString, FeatureIssues } from '../models/types';
import { sortGraph } from '../utils/sort';
import { IndexCache, readAndHashFile, computeCommentHash, loadPersistentIndex, upsertPersistentEntry, removePersistentEntries } from './cache';
import { parseText } from '../utils/parser';
import { logger } from '../utils/logger';

// 将用户配置的忽略目录数组转换为 findFiles 的排除 glob
function buildExcludeGlob(ignorePaths: string[]): string {
  const parts = ignorePaths.map(p => `**/${p}/**`);
  return `{${parts.join(',')}}`;
}

export async function scanWorkspace(cache?: IndexCache): Promise<Graph> {
  // 读取用户配置：前缀、忽略目录
  const cfg = vscode.workspace.getConfiguration('flow');
  const prefix = cfg.get<string>('prefix', 'flow');
  const styles = cfg.get<string[]>('commentStyles', ['//']);
  const ignorePaths = cfg.get<string[]>('ignorePaths', ['node_modules', 'dist', '.git']);
  const includeGlobs = cfg.get<string[]>('includeGlobs', ['**/*.{ts,tsx,js,jsx}', '**/*.{java,kt}', '**/*.{go}', '**/*.{py}']);
  const scanConcurrency = cfg.get<number>('scanConcurrency', 8);

  const persisted = await loadPersistentIndex();
  const persistedMap = new Map<string, Node[]>();
  for (const e of persisted) {
    cache?.set(e.file, { fileHash: e.fileHash, commentHash: e.commentHash });
    persistedMap.set(e.file, e.nodes);
  }

  // 使用稳定 API：遍历文件并直接读取内容解析（无需打开编辑器文档）
  // 基于 includeGlobs 聚合待扫描文件集合
  let uris: vscode.Uri[] = [];
  if (persistedMap.size > 0) {
    const set = new Set<string>();
    for (const file of persistedMap.keys()) {
      set.add(file);
    }
    uris = Array.from(set).map(f => vscode.Uri.file(f));
  } else {
    const excludeGlob = buildExcludeGlob(ignorePaths);
    const uriSet = new Map<string, vscode.Uri>();
    for (const inc of includeGlobs) {
      const found = await vscode.workspace.findFiles(inc, excludeGlob);
      for (const u of found) {
        uriSet.set(u.fsPath, u);
      }
    }
    uris = Array.from(uriSet.values());
  }

  const features: Record<string, FeatureGraph> = {};
  const persistEntries: Array<{ file: string; fileHash: string; commentHash: string; nodes: Node[] }> = [];
  // 并发分批处理，快速前缀过滤避免逐行解析无关文件
  for (let i = 0; i < uris.length; i += scanConcurrency) {
    const batch = uris.slice(i, i + scanConcurrency);
    await Promise.all(batch.map(async (uri) => {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        const kb = Math.ceil(Number(stat.size) / 1024);
        const maxKB = cfg.get<number>('maxFileSizeKB', 1024);
        if (kb > maxKB) {
          return;
        }
        const buf = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(buf);
        // 快速前缀检测：文件不包含前缀则跳过（基于支持的注释样式）
        const candidates = styles.flatMap(s => [ `${s} ${prefix}-`, `${s}${prefix}-` ]);
        if (!candidates.some(c => text.indexOf(c) !== -1)) {
          return;
        }
        const nodes = parseText(text, uri.fsPath, prefix, styles);
        if (!nodes.length) {
          return;
        }
        const fileHash = await readAndHashFile(uri);
        const commentHash = computeCommentHash(nodes);
        cache?.set(uri.fsPath, { fileHash, commentHash });
        persistEntries.push({ file: uri.fsPath, fileHash, commentHash, nodes });
        for (const n of nodes) {
          if (!features[n.feature]) {
            features[n.feature] = { feature: n.feature, nodes: [] };
          }
          features[n.feature].nodes.push(n);
        }
      } catch (err) {
        logger.error('scanWorkspace: file processing failed', { file: uri.fsPath, err });
      }
    }));
  }

  // 若解析为空，返回空图（视图会展示占位，并在编辑/保存或刷新后更新）

  // 基础校验：统计 start/end 唯一性与 step 序号重复
  for (const f of Object.values(features)) {
    f.issues = computeFeatureIssues(f);
  }
  const graph: Graph = { features };
  // 仅在注释层面发生变化或有文件删除时才更新持久索引
  const changed: string[] = [];
  for (const e of persistEntries) {
    const old = persistedMap.get(e.file) || [];
    const oldHash = computeCommentHash(old);
    if (oldHash !== e.commentHash) {
      await upsertPersistentEntry(e);
      changed.push(e.file);
    }
  }
  const scannedFiles = new Set(persistEntries.map(e => e.file));
  const toDrop: string[] = [];
  for (const file of persistedMap.keys()) {
    if (!scannedFiles.has(file)) {
      toDrop.push(file);
    }
  }
  if (toDrop.length) {
    await removePersistentEntries(toDrop);
  }
  return sortGraph(graph);
}

// 使用中文注释：根据文件更新图结构（先清理该文件旧节点，再加入新节点）
export function updateGraphForFile(graph: Graph, filePath: string, nodes: Node[]): Graph {
  // 先删除旧节点（遍历所有 feature，将来自该文件的节点移除）
  for (const [feature, fg] of Object.entries(graph.features)) {
    fg.nodes = fg.nodes.filter(n => n.file !== filePath);
    if (fg.nodes.length === 0) {
      delete graph.features[feature];
    }
  }
  // 将新节点按 feature 聚合写入图结构
  for (const n of nodes) {
    if (!graph.features[n.feature]) {
      graph.features[n.feature] = { feature: n.feature, nodes: [] };
    }
    graph.features[n.feature].nodes.push(n);
  }
  // 重新计算基础校验（只针对受影响的 feature 更严谨，这里简化为全量计算）
  for (const f of Object.values(graph.features)) {
    f.issues = computeFeatureIssues(f);
  }
  return sortGraph(graph);
}

export function computeFeatureIssues(f: FeatureGraph): FeatureIssues {
  const startCount = f.nodes.filter(n => n.role === 'start').length;
  const endCount = f.nodes.filter(n => n.role === 'end').length;
  const orders = new Map<string, number>();
  for (const n of f.nodes) {
    if (n.role === 'step') {
      const key = orderToString(n.order);
      if (key) {
        orders.set(key, (orders.get(key) || 0) + 1);
      }
    }
  }
  const duplicateOrders: Array<{ order: string; count: number }> = [];
  orders.forEach((count, order) => {
    if (count > 1) {
      duplicateOrders.push({ order, count });
    }
  });
  return {
    missingStart: startCount === 0 || startCount > 1,
    missingEnd: endCount === 0 || endCount > 1,
    duplicateOrders: duplicateOrders.length ? duplicateOrders : undefined,
  };
}
