import * as vscode from 'vscode';

function selectThemePalette(kind: vscode.ColorThemeKind) {
  if (kind === vscode.ColorThemeKind.Dark) {
    return {
      tokenBg: 'rgba(255, 193, 7, 0.22)',
      tokenText: '#FAFAFA',
      highlightBg: 'rgba(255, 193, 7, 0.14)',
      highlightText: '#FAFAFA'
    };
  }
  if (kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight) {
    return {
      tokenBg: 'rgba(0, 174, 255, 0.30)',
      tokenText: undefined,
      highlightBg: 'rgba(0, 174, 255, 0.20)',
      highlightText: undefined
    };
  }
  return {
    tokenBg: 'rgba(255, 193, 7, 0.28)',
    tokenText: '#1A1A1A',
    highlightBg: 'rgba(255, 193, 7, 0.16)',
    highlightText: '#1A1A1A'
  };
}

export function buildDecorations() {
  const c = vscode.workspace.getConfiguration('flow');
  const theme = vscode.window.activeColorTheme.kind;
  const palette = selectThemePalette(theme);
  const highlightBg = c.get<string>('highlightBackground') ?? palette.highlightBg;
  const highlightText = c.get<string>('highlightColor') ?? palette.highlightText;
  const tokenBg = c.get<string>('tokenBackground') ?? (c.get<string>('hintBackground') ?? palette.tokenBg);
  const tokenText = c.get<string>('tokenColor') ?? palette.tokenText;

  const highlightOptions: vscode.DecorationRenderOptions = {
    isWholeLine: true,
    backgroundColor: highlightBg,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  };
  if (highlightText) {
    highlightOptions.color = highlightText;
  }
  const hintOptions: vscode.DecorationRenderOptions = {
    backgroundColor: tokenBg,
    overviewRulerLane: vscode.OverviewRulerLane.Right
  };
  if (tokenText) {
    hintOptions.color = tokenText;
  }
  return {
    highlight: vscode.window.createTextEditorDecorationType(highlightOptions),
    hint: vscode.window.createTextEditorDecorationType(hintOptions)
  };
}