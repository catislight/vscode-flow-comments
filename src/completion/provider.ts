import * as vscode from 'vscode';
import { Graph } from '../models/types';
import { parser } from '../services/api';
import { loadPersistentIndex } from '../indexer/cache';
import { pinyin } from 'pinyin-pro';

function buildAbbr(name: string): string {
  try {
    const arr = pinyin(name, { pattern: 'initial', type: 'array' }) as string[];
    return arr.map(s => (s || '').toLowerCase()).join('');
  } catch {
    return name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }
}

function buildFull(name: string): string {
  try {
    const arr = pinyin(name, { toneType: 'none', type: 'array' }) as string[];
    return arr.map(s => (s || '').toLowerCase()).join('');
  } catch {
    return name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }
}

function normalize(s: string): string { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

export function registerCompletionProvider(context: vscode.ExtensionContext, getGraph: () => Graph): void {
  const completionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file' }, {
    async provideCompletionItems(document, position) {
      const cfg = vscode.workspace.getConfiguration('flow');
      const prefix = cfg.get<string>('prefix', 'flow')!;
      const styles = cfg.get<string[]>('commentStyles', ['//']);
      const lineText = document.lineAt(position.line).text;
      const styleCtx = matchStyleAndPrefix(lineText, position, styles, prefix);
      if (!styleCtx) { return undefined; }
      const features = await resolveFeatures(getGraph, document, prefix);
      if (!features.length) { return undefined; }
      const titleIndex = await resolveTitleIndex(getGraph, document, prefix, document.uri.fsPath, position.line);
      const token = computeTokenInfo(styleCtx.afterStyle, prefix, position);
      const items = token.useSegment
        ? buildSegmentItems(features, prefix, token.body, token.typedSep, token.fullTokenRange, titleIndex)
        : buildFlatItems(features, prefix, token.partial, token.range, titleIndex);
      return new vscode.CompletionList(items, true);
    }
  }, 'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  '-', '_', '/', '\\', '.', ',', ';', ':', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', '<', '>', '?', '~', ' ');
  context.subscriptions.push(completionProvider);
}
const SEPARATORS = ['/', '-', '_', '.', ',', ';', ':', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', '<', '>', '?', '~', '\\'];

function sepRegex(): RegExp {
  const cls = SEPARATORS.map(ch => ch.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')).join('');
  return new RegExp(`[${cls}]`, 'g');
}

function matchStyleAndPrefix(lineText: string, position: vscode.Position, styles: string[], prefix: string): { styleHit: string; afterStyle: string } | undefined {
  const before = lineText.slice(0, position.character);
  const trimmedStart = before.replace(/^\s+/, '');
  const styleHit = styles.find(s => trimmedStart.startsWith(s));
  if (!styleHit) { return undefined; }
  const afterStyle = trimmedStart.slice(styleHit.length).replace(/^\s+/, '');
  const rootLike = afterStyle.toLowerCase().startsWith(`${prefix.toLowerCase()}-`);
  if (!rootLike) { return undefined; }
  return { styleHit, afterStyle };
}

async function resolveFeatures(getGraph: () => Graph, document: vscode.TextDocument, prefix: string): Promise<string[]> {
  let features = Object.keys(getGraph().features);
  if (features.length) { return features; }
  try {
    const docText = document.getText();
    const nodes2 = parser.parseText(docText, document.uri.fsPath, prefix);
    const set = new Set<string>();
    for (const n of nodes2) { set.add(n.feature); }
    features = Array.from(set);
  } catch {}
  if (features.length) { return features; }
  try {
    const persisted = await loadPersistentIndex();
    const set2 = new Set<string>();
    for (const e of persisted) {
      for (const n of e.nodes) { set2.add(n.feature); }
    }
    features = Array.from(set2);
  } catch {}
  return features;
}

async function resolveTitleIndex(getGraph: () => Graph, document: vscode.TextDocument, prefix: string, currentFile: string, currentLineZeroBased: number): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const g = getGraph();
  for (const [feat, fg] of Object.entries(g.features)) {
    for (const n of fg.nodes) {
      if (n.role === 'title') {
        const t = n.meta?.title || '';
        if (t && !(n.file === currentFile && n.line === currentLineZeroBased + 1)) {
          const s = map.get(feat) || new Set<string>();
          s.add(t);
          map.set(feat, s);
        }
      }
    }
  }
  try {
    const text = document.getText();
    const nodes = parser.parseText(text, document.uri.fsPath, prefix);
    for (const n of nodes) {
      if (n.role === 'title') {
        const feat = n.feature;
        const t = n.meta?.title || '';
        if (t && !(n.file === currentFile && n.line === currentLineZeroBased + 1)) {
          const s = map.get(feat) || new Set<string>();
          s.add(t);
          map.set(feat, s);
        }
      }
    }
  } catch {}
  try {
    const persisted = await loadPersistentIndex();
    for (const e of persisted) {
      for (const n of e.nodes) {
        if (n.role === 'title') {
          const feat = n.feature;
          const t = n.meta?.title || '';
          if (t) {
            const s = map.get(feat) || new Set<string>();
            s.add(t);
            map.set(feat, s);
          }
        }
      }
    }
  } catch {}
  return map;
}

function computeTokenInfo(afterStyle: string, prefix: string, position: vscode.Position): {
  body: string;
  typedSep: string;
  partial: string;
  useSegment: boolean;
  range: vscode.Range;
  fullTokenRange: vscode.Range;
} {
  const tokenUntilSpace = afterStyle.split(/\s/)[0];
  const body = tokenUntilSpace.slice(prefix.length + 1);
  const startOfBodyCol = position.character - body.length;
  const fullTokenRange = new vscode.Range(new vscode.Position(position.line, Math.max(startOfBodyCol, 0)), position);
  let typedSep = '';
  let lastIdx = -1;
  for (const s of SEPARATORS) { const i = body.lastIndexOf(s); if (i > lastIdx) { lastIdx = i; typedSep = s; } }
  let partial = '';
  let range: vscode.Range;
  let useSegment = false;
  if (lastIdx >= 0) {
    useSegment = true;
    partial = body.slice(lastIdx + typedSep.length);
    const startCol = position.character - partial.length;
    range = new vscode.Range(new vscode.Position(position.line, Math.max(startCol, 0)), position);
  } else {
    partial = body;
    const startCol = position.character - partial.length;
    range = new vscode.Range(new vscode.Position(position.line, Math.max(startCol, 0)), position);
  }
  return { body, typedSep, partial, useSegment, range, fullTokenRange };
}

function buildSegmentItems(features: string[], prefix: string, body: string, typedSep: string, fullTokenRange: vscode.Range, titleIndex: Map<string, Set<string>>): vscode.CompletionItem[] {
  const r = sepRegex();
  const partsRaw = body.split(r);
  const baseRaw = partsRaw.slice(0, -1);
  const mkRaw = partsRaw[partsRaw.length - 1] || '';
  const endsWithSep = SEPARATORS.some(s => body.endsWith(s));
  const mkNorm = endsWithSep ? '' : normalize(mkRaw);
  const seen = new Set<string>();
  const items: vscode.CompletionItem[] = [];
  for (const feature of features) {
    const segsRaw = feature.split(r);
    const sepsRaw = feature.match(r) || [];
    const segsPin = segsRaw.map(buildFull);
    let ok = true;
    for (let i = 0; i < baseRaw.length; i++) {
      const typed = baseRaw[i] || '';
      if (!typed) { continue; }
      const hasNonAscii = /[^\x00-\x7F]/.test(typed);
      const pin = segsPin[i] || '';
      const raw = segsRaw[i] || '';
      if (hasNonAscii) {
        if (!raw.toLowerCase().startsWith(typed.toLowerCase())) { ok = false; break; }
      } else {
        const tn = normalize(typed);
        if (!(pin.startsWith(tn) || buildAbbr(raw).startsWith(tn))) { ok = false; break; }
      }
    }
    if (!ok) { continue; }
    const isExactBase = baseRaw.length === segsRaw.length;
    const typedBaseNorm = normalize(baseRaw.join(''));
    const featureNorm = normalize(segsRaw.join(''));
    if ((isExactBase || typedBaseNorm === featureNorm) && typedSep === '-') {
      const titles = Array.from(titleIndex.get(feature) || new Set<string>());
      for (const t of titles) {
        const abbrT = buildAbbr(t);
        const fullT = buildFull(t);
        const chineseMatchT = /[^\x00-\x7F]/.test(mkRaw) ? t.toLowerCase().startsWith(mkRaw.toLowerCase()) : false;
        if (mkNorm && !(abbrT.startsWith(mkNorm) || fullT.startsWith(mkNorm) || chineseMatchT)) { continue; }
        const sep = '-';
        const canonicalFeature = segsRaw.join(sep);
        const label = `${prefix}-${canonicalFeature}-${t}`;
        if (seen.has(label)) { continue; }
        seen.add(label);
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
        const abbrPath = segsRaw.map(buildAbbr).join(sep);
        item.filterText = `${canonicalFeature}-${t} ${canonicalFeature} ${segsPin.join(sep)} ${abbrPath} ${t} ${fullT} ${abbrT}`;
        item.insertText = `${canonicalFeature}-${t}`;
        (item as vscode.CompletionItem).range = fullTokenRange as any;
        items.push(item);
      }
      continue;
    }
    if (baseRaw.length > 0) {
      const idxSep = baseRaw.length - 1;
      if (sepsRaw[idxSep] !== typedSep) { continue; }
    }
    const firstRem = segsRaw[baseRaw.length];
    const sep = typedSep || '/';
    const remaining = segsRaw.slice(baseRaw.length).join(sep);
    if (!firstRem || !remaining) { continue; }
    const abbr = buildAbbr(firstRem);
    const full = buildFull(firstRem);
    if (mkNorm && !(abbr.startsWith(mkNorm) || full.startsWith(mkNorm) || firstRem.toLowerCase().startsWith(mkRaw.toLowerCase()))) { continue; }
    const canonicalBase = segsRaw.slice(0, baseRaw.length).join(sep);
    const label = `${prefix}-${canonicalBase}${sep}${remaining}`;
    if (seen.has(label)) { continue; }
    seen.add(label);
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
    const abbrPath = segsRaw.map(buildAbbr).join(sep);
    item.filterText = `${segsRaw.join(sep)} ${segsPin.join(sep)} ${abbrPath}`;
    item.insertText = segsRaw.join(sep);
    (item as vscode.CompletionItem).range = fullTokenRange as any;
    items.push(item);
  }
  return items;
}

function buildFlatItems(features: string[], prefix: string, partial: string, range: vscode.Range, titleIndex: Map<string, Set<string>>): vscode.CompletionItem[] {
  const mkRaw = partial;
  const endsWithHyphen = mkRaw.endsWith('-');
  const mkNorm = endsWithHyphen ? '' : mkRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const items: vscode.CompletionItem[] = [];
  for (const feature of features) {
    const abbr = buildAbbr(feature);
    const full = buildFull(feature);
    const hasNonAscii = /[^\x00-\x7F]/.test(mkRaw);
    const chineseMatch = hasNonAscii ? feature.toLowerCase().startsWith(mkRaw.toLowerCase()) : false;
    const featureMatches = !(mkNorm) || (abbr.startsWith(mkNorm) || full.startsWith(mkNorm) || chineseMatch);
    if (!featureMatches) { continue; }
    const item = new vscode.CompletionItem(`${prefix}-${feature}`, vscode.CompletionItemKind.Keyword);
    item.filterText = `${feature} ${full} ${abbr}`;
    item.insertText = feature;
    (item as vscode.CompletionItem).range = range as any;
    items.push(item);
    const titles = Array.from(titleIndex.get(feature) || new Set<string>());
    for (const t of titles) {
      const abbrT = buildAbbr(t);
      const fullT = buildFull(t);
      const label = `${prefix}-${feature}-${t}`;
      const itemT = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
      itemT.filterText = `${feature} ${full} ${abbr} ${t} ${fullT} ${abbrT}`;
      itemT.insertText = `${feature}-${t}`;
      (itemT as vscode.CompletionItem).range = range as any;
      items.push(itemT);
    }
  }
  return items;
}
