export function prefixIndex(lineText: string, prefix: string): number {
  const i1 = lineText.indexOf(`${prefix}-`);
  if (i1 >= 0) { return i1; }
  const i2 = lineText.indexOf(`${prefix} -`);
  if (i2 >= 0) { return i2; }
  const re = new RegExp(`\\b${prefix}\\b`);
  const m = lineText.match(re);
  return m && typeof m.index === 'number' ? m.index : -1;
}
