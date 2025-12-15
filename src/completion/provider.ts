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
      const before = lineText.slice(0, position.character);
      const trimmedStart = before.replace(/^\s+/, '');
      const styleHit = styles.find(s => trimmedStart.startsWith(s));
      if (!styleHit) { return undefined; }
      const afterStyle = trimmedStart.slice(styleHit.length).replace(/^\s+/, '');
      const rootLike = afterStyle.toLowerCase().startsWith(`${prefix.toLowerCase()}-`);
      if (!rootLike) { return undefined; }

      let features = Object.keys(getGraph().features);
      if (!features.length) {
        try {
          const docText = document.getText();
          const nodes2 = parser.parseText(docText, document.uri.fsPath, prefix);
          const set = new Set<string>();
          for (const n of nodes2) { set.add(n.feature); }
          features = Array.from(set);
        } catch {}
        if (!features.length) {
          try {
            const persisted = await loadPersistentIndex();
            const set2 = new Set<string>();
            for (const e of persisted) {
              for (const n of e.nodes) { set2.add(n.feature); }
            }
            features = Array.from(set2);
          } catch {}
        }
        if (!features.length) { return undefined; }
      }

      const effectiveStyle = styleHit || (styles[0] || '//');
      const leading = styleHit ? '' : `${effectiveStyle} `;
      let range: vscode.Range;
      let basePath = '';
      let partial = '';
      let useSegment = false;
      const tokenUntilSpace = afterStyle.split(/\s/)[0];
      const body = tokenUntilSpace.slice(prefix.length + 1);
      const startOfBodyCol = position.character - body.length;
      const fullTokenRange = new vscode.Range(new vscode.Position(position.line, Math.max(startOfBodyCol, 0)), position);
      const seps = ['/', '-', '_', '.', ',', ';', ':', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', '<', '>', '?', '~', '\\', '、', '，', '。'];
      let typedSep = '';
      let lastIdx = -1;
      for (const s of seps) { const i = body.lastIndexOf(s); if (i > lastIdx) { lastIdx = i; typedSep = s; } }
      if (lastIdx >= 0) {
        useSegment = true;
        basePath = body.slice(0, lastIdx + typedSep.length);
        partial = body.slice(lastIdx + typedSep.length);
        const startCol = position.character - partial.length;
        range = new vscode.Range(new vscode.Position(position.line, Math.max(startCol, 0)), position);
      } else {
        partial = body;
        const startCol = position.character - partial.length;
        range = new vscode.Range(new vscode.Position(position.line, Math.max(startCol, 0)), position);
      }

      const items: vscode.CompletionItem[] = [];
      if (useSegment) {
        const sepClass = seps.map(ch => ch.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')).join('');
        const sepRegex = new RegExp(`[${sepClass}]`, 'g');
        const partsRaw = body.split(sepRegex);
        const baseRaw = partsRaw.slice(0, -1);
        const mkRaw = partsRaw[partsRaw.length - 1] || '';
        const endsWithSep = seps.some(s => body.endsWith(s));
        const mkNorm = endsWithSep ? '' : normalize(mkRaw);
        const seen = new Set<string>();
        for (const feature of features) {
          const segsRaw = feature.split(sepRegex);
          const sepsRaw = feature.match(sepRegex) || [];
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
      } else {
        const mkRaw = partial;
        const endsWithHyphen = mkRaw.endsWith('-');
        const mkNorm = endsWithHyphen ? '' : mkRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const feature of features) {
          const abbr = buildAbbr(feature);
          const full = buildFull(feature);
          const hasNonAscii = /[^\x00-\x7F]/.test(mkRaw);
          const chineseMatch = hasNonAscii ? feature.toLowerCase().startsWith(mkRaw.toLowerCase()) : false;
          if (mkNorm && !(abbr.startsWith(mkNorm) || full.startsWith(mkNorm) || chineseMatch)) { continue; }
          const item = new vscode.CompletionItem(`${prefix}-${feature}`, vscode.CompletionItemKind.Keyword);
          item.filterText = `${feature} ${full} ${abbr}`;
          item.insertText = feature;
          (item as vscode.CompletionItem).range = range as any;
          items.push(item);
        }
      }
      return new vscode.CompletionList(items, true);
    }
  }, 'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  '-', '_', '/', '\\', '.', ',', ';', ':', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', '<', '>', '?', '~', '、', '，', '。', ' ');
  context.subscriptions.push(completionProvider);
}

