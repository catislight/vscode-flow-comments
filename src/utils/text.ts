export function prefixIndex(lineText: string, prefix: string): number {
  const i1 = lineText.indexOf(`${prefix}-`);
  const i2 = lineText.indexOf(`${prefix} -`);
  return i1 >= 0 ? i1 : i2;
}