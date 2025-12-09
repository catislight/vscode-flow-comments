import * as vscode from 'vscode';
import { Node } from '../models/types';
import crypto from 'crypto';

export interface CacheEntry {
  fileHash: string;
  commentHash: string;
}

export class IndexCache {
  private store = new Map<string, CacheEntry>();

  get(file: string): CacheEntry | undefined { return this.store.get(file); }
  set(file: string, entry: CacheEntry): void { this.store.set(file, entry); }
}

// 计算内容哈希（字符串或二进制），用于快速判断是否变更
export function hashBuffer(buf: Uint8Array): string {
  const h = crypto.createHash('sha1');
  h.update(Buffer.from(buf));
  return h.digest('hex');
}

export function hashString(text: string): string {
  const h = crypto.createHash('sha1');
  h.update(text);
  return h.digest('hex');
}

// 基于解析得到的节点集合生成注释层面的哈希，避免纯逻辑变化影响结果
export function computeCommentHash(nodes: Node[]): string {
  const payload = nodes.map(n => ({
    f: n.feature,
    r: n.role,
    o: n.order && n.order.levels ? n.order.levels.join('.') : '',
    d: n.meta?.desc || '',
    t: (n.meta?.tags || []).join(','),
  }));
  return hashString(JSON.stringify(payload));
}

// 读取文件内容并计算文件哈希（用于冷启动扫描阶段）
export async function readAndHashFile(uri: vscode.Uri): Promise<string> {
  const buf = await vscode.workspace.fs.readFile(uri);
  return hashBuffer(buf);
}

export interface PersistEntry {
  file: string;
  fileHash: string;
  commentHash: string;
  nodes: Node[];
}

function getPersistentUri(): vscode.Uri | null {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws || ws.length === 0) {
    return null;
  }
  return vscode.Uri.joinPath(ws[0].uri, '.vscode', 'flow-comments.index.json');
}

export async function loadPersistentIndex(): Promise<PersistEntry[]> {
  const uri = getPersistentUri();
  if (!uri) {
    return [];
  }
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(buf).toString('utf-8');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed as PersistEntry[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function savePersistentIndex(entries: PersistEntry[]): Promise<void> {
  const uri = getPersistentUri();
  if (!uri) {
    return;
  }
  const dir = vscode.Uri.joinPath(uri, '..');
  try {
    await vscode.workspace.fs.stat(dir);
  } catch {
    await vscode.workspace.fs.createDirectory(dir);
  }
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(entries));
  await vscode.workspace.fs.writeFile(uri, data);
}

export async function upsertPersistentEntry(entry: PersistEntry): Promise<void> {
  const list = await loadPersistentIndex();
  const idx = list.findIndex(e => e.file === entry.file);
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  await savePersistentIndex(list);
}