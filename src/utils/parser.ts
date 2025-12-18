import { Node, Role, OrderParts, Meta, createNodeId } from '../models/types';

function buildNewRegex(prefix: string, styles: string[] = ['//']): RegExp {
  const p = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escaped = styles.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const opener = `(?:${escaped.join('|')})`;
  return new RegExp(`^\\s*${opener}\\s*${p}-\\s*(.+?)\\s+(start|end|[0-9]+(?:\\.[0-9]+)*)\\s*(.*)$`, 'i');
}

function buildTitleRegex(prefix: string, styles: string[] = ['//']): RegExp {
  const p = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escaped = styles.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const opener = `(?:${escaped.join('|')})`;
  // pattern: // flow-<feature>-<title> <desc>
  return new RegExp(`^\\s*${opener}\\s*${p}-\\s*([^\\s-][^\\s]*)-([^\\s].*)$`, 'i');
}

function buildMarkRegex(markPrefix: string, styles: string[] = ['//']): RegExp {
  const p = markPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escaped = styles.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const opener = `(?:${escaped.join('|')})`;
  return new RegExp(`^\\s*${opener}\\s*${p}(?:-\\s*(.+))?$`, 'i');
}

function buildNoOrderRegex(prefix: string, styles: string[] = ['//']): RegExp {
  const p = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escaped = styles.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const opener = `(?:${escaped.join('|')})`;
  // pattern: // flow-<feature> <desc>
  return new RegExp(`^\\s*${opener}\\s*${p}-\\s*([^\\s]+)\\s+(.+)$`, 'i');
}

function parseOrder(raw?: string): OrderParts | undefined {
  if (!raw) {
    return undefined;
  }
  const nums = raw.split('.').map(s => Number(s)).filter(n => Number.isFinite(n));
  if (nums.length === 0) {
    return undefined;
  }
  return { levels: nums };
}

function parseMeta(raw?: string): Meta | undefined {
  if (!raw) {
    return undefined;
  }
  const descMatch = raw.match(/\bdesc="([^"]*)"/i);
  const tagsMatch = raw.match(/\btags=([^\s\]]+)/i);
  const meta: Meta = {};
  if (descMatch) {
    meta.desc = descMatch[1];
  }
  if (tagsMatch) {
    const list = tagsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    if (list.length > 0) {
      meta.tags = list;
    }
  }
  return Object.keys(meta).length ? meta : undefined;
}

export function parseLine(line: string, file: string, lineNumber: number, prefix = 'flow', styles: string[] = ['//']): Node | null {
  // try title syntax first
  const titleRe = buildTitleRegex(prefix, styles);
  const mt = line.match(titleRe);
  if (mt) {
    const feature = mt[1].trim();
    const title = (mt[2] || '').trim().split(/\s+/)[0];
    const desc = (mt[2] || '').trim().slice(title.length).trim();
    const role: Role = 'title' as Role;
    const id = createNodeId(feature, role, undefined, file, lineNumber);
    const meta: Meta = {};
    if (title) { meta.title = title; }
    if (desc) { meta.desc = desc; }
    return { id, feature, role, order: undefined, file, line: lineNumber, meta };
  }
  // fallback to original syntax
  const newer = buildNewRegex(prefix, styles);
  const m = line.match(newer);
  if (!m) {
    // fallback to no-order syntax
    const noOrderRe = buildNoOrderRegex(prefix, styles);
    const mNoOrder = line.match(noOrderRe);
    if (mNoOrder) {
      const feature = mNoOrder[1].trim();
      const desc = mNoOrder[2].trim();
      const role: Role = 'step';
      const id = createNodeId(feature, role, undefined, file, lineNumber);
      const meta: Meta = { desc };
      return { id, feature, role, order: undefined, file, line: lineNumber, meta };
    }
    return null;
  }
  const feature = m[1].trim();
  const kind = m[2].trim().toLowerCase();
  const desc = (m[3] || '').trim();
  if (kind === 'start' || kind === 'end') {
    const role: Role = kind as Role;
    const id = createNodeId(feature, role, undefined, file, lineNumber);
    const meta: Meta | undefined = desc ? { desc } : undefined;
    return { id, feature, role, order: undefined, file, line: lineNumber, meta };
  } else {
    const order = parseOrder(kind);
    const role: Role = 'step';
    const meta: Meta | undefined = desc ? { desc } : undefined;
    const id = createNodeId(feature, role, order, file, lineNumber);
    return { id, feature, role, order, file, line: lineNumber, meta };
  }
}

export function parseText(text: string, file: string, prefix = 'flow', styles: string[] = ['//'], markPrefix = 'mark'): Node[] {
  const nodes: Node[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = parseLine(line, file, i + 1, prefix, styles);
    if (n) {
      nodes.push(n);
      continue;
    }
    const mr = line.match(buildMarkRegex(markPrefix, styles));
    if (mr) {
      const desc = (mr[1] || '').trim();
      const role: Role = 'mark';
      const feature = 'MARK';
      const id = createNodeId(feature, role, undefined, file, i + 1);
      const meta: Meta | undefined = desc ? { desc } : undefined;
      nodes.push({ id, feature, role, file, line: i + 1, meta });
    }
  }
  return nodes;
}
