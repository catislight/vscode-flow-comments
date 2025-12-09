import * as vscode from 'vscode';
import { Graph } from '../models/types';
import { computeFeatureIssues } from '../indexer/workspaceIndexer';
import { prefixIndex } from '../utils/text';

export function applyDiagnosticsFromGraph(graph: Graph, diagnosticCollection: vscode.DiagnosticCollection): void {
  // flow-诊断 start
  // flow-诊断 1 清空已存在的诊断集合
  diagnosticCollection.clear();
  const map = new Map<string, vscode.Diagnostic[]>();
  // flow-诊断 2 读取严格模式开关；关闭时不出具诊断
  const strict = vscode.workspace.getConfiguration('flow').get<boolean>('strictMode', false);
  if (!strict) {
    for (const [file] of map.entries()) {
      diagnosticCollection.set(vscode.Uri.file(file), []);
    }
    return;
  }
  // flow-诊断 3 前缀范围计算：定位到注释中前缀词并形成精准范围
  function prefixRange(textDoc: vscode.TextDocument | undefined, ln: number, prefix: string): vscode.Range {
    if (textDoc && ln >= 0 && ln < textDoc.lineCount) {
      const lineText = textDoc.lineAt(ln).text;
      const idx = prefixIndex(lineText, prefix);
      if (idx >= 0) {
        const token = lineText.slice(idx);
        let len = prefix.length;
        if (token.startsWith(`${prefix}-`)) { len = prefix.length + 1; }
        else if (token.startsWith(`${prefix} -`)) { len = prefix.length + 2; }
        return new vscode.Range(new vscode.Position(ln, idx), new vscode.Position(ln, idx + len));
      }
      // 尝试在相邻行扫描，修正潜在的行号偏移
      for (const d of [-1, 1, -2, 2]) {
        const alt = ln + d;
        if (alt >= 0 && alt < textDoc.lineCount) {
          const t = textDoc.lineAt(alt).text;
          const j = prefixIndex(t, prefix);
          if (j >= 0) {
            const token2 = t.slice(j);
            let len2 = prefix.length;
            if (token2.startsWith(`${prefix}-`)) { len2 = prefix.length + 1; }
            else if (token2.startsWith(`${prefix} -`)) { len2 = prefix.length + 2; }
            return new vscode.Range(new vscode.Position(alt, j), new vscode.Position(alt, j + len2));
          }
        }
      }
      return textDoc.lineAt(ln).range;
    }
    return new vscode.Range(new vscode.Position(Math.max(ln, 0), 0), new vscode.Position(Math.max(ln, 0), 0));
  }
  // flow-诊断 4 遍历每个 feature 并按规则生成诊断
  for (const f of Object.values(graph.features)) {
    // flow-诊断 4.0 计算当前 feature 的问题集（无缓存则即时计算）
    const issues = f.issues || computeFeatureIssues(f);
    // flow-诊断 4.1 重复步骤序号：在对应步骤行提示
    if (issues?.duplicateOrders?.length) {
      // flow-诊断 4.1.1 遍历每条重复的步骤序号记录
      for (const d of issues.duplicateOrders) {
        // flow-诊断 4.1.2 筛选出该序号对应的步骤节点列表
        const nodes = f.nodes.filter(n => n.role === 'step' && (n.order && n.order.levels && n.order.levels.join('.') === d.order));
        // flow-诊断 4.1.3 针对每个重复节点生成诊断并累积
        for (const n of nodes) {
          // flow-诊断 4.1.3.1 定位目标文件 URI
          const uri = vscode.Uri.file(n.file);
          // flow-诊断 4.1.3.2 获取内存中文档以便计算精确范围
          const textDoc = vscode.workspace.textDocuments.find(td => td.uri.fsPath === n.file);
          // flow-诊断 4.1.3.3 将 1-based 行号转换为 0-based
          const ln = Math.max(n.line - 1, 0);
          // flow-诊断 4.1.3.4 读取前缀配置（例如 flow）
          const prefix = vscode.workspace.getConfiguration('flow').get<string>('prefix', 'flow')!;
          // flow-诊断 4.1.3.5 计算前缀词的精确范围以提升可读性
          const range = prefixRange(textDoc, ln, prefix);
          // flow-诊断 4.1.3.6 创建 Warning 级别诊断并写入消息
          const diag = new vscode.Diagnostic(range, `序号重复 ${d.order}（出现 ${d.count} 次）`, vscode.DiagnosticSeverity.Warning);
          // flow-诊断 4.1.3.7 将诊断累积到文件映射中
          const arr = map.get(uri.fsPath) || [];
          arr.push(diag);
          map.set(uri.fsPath, arr);
        }
      }
    }
    // flow-诊断 4.x 预分组：收集 start 和 end 节点集
    const startNodes = f.nodes.filter(n => n.role === 'start');
    const endNodes = f.nodes.filter(n => n.role === 'end');
    // flow-诊断 4.2 start 缺失或重复：缺失贴在代表行，重复仅对后续多余项提示
    if (issues?.missingStart) {
      // flow-诊断 4.2.1 缺失 start 的情况：在代表行提示
      if (startNodes.length === 0) {
        // flow-诊断 4.2.1.1 选取代表行（优先 step，其次 end）
        const representative = f.nodes.find(n => n.role === 'step') || f.nodes.find(n => n.role === 'end');
        if (representative) {
          // flow-诊断 4.2.1.2 计算范围并生成诊断
          const uri = vscode.Uri.file(representative.file);
          const textDoc = vscode.workspace.textDocuments.find(td => td.uri.fsPath === representative.file);
          const ln = Math.max(representative.line - 1, 0);
          const prefix = vscode.workspace.getConfiguration('flow').get<string>('prefix', 'flow')!;
          const range = prefixRange(textDoc, ln, prefix);
          const diag = new vscode.Diagnostic(range, `${f.feature} 缺失 start`, vscode.DiagnosticSeverity.Warning);
          const arr = map.get(uri.fsPath) || [];
          arr.push(diag);
          map.set(uri.fsPath, arr);
        }
      } else {
        // flow-诊断 4.2.2 处理重复 start：跳过第一个，其余逐一标记
        const dupStarts = startNodes.slice(1);
        // flow-诊断 4.2.2.1 遍历多余的 start 节点
        for (const n of dupStarts) {
          const uri = vscode.Uri.file(n.file);
          const textDoc = vscode.workspace.textDocuments.find(td => td.uri.fsPath === n.file);
          const ln = Math.max(n.line - 1, 0);
          const prefix = vscode.workspace.getConfiguration('flow').get<string>('prefix', 'flow')!;
          const range = prefixRange(textDoc, ln, prefix);
          const diag = new vscode.Diagnostic(range, `${f.feature} 重复 start`, vscode.DiagnosticSeverity.Warning);
          const arr = map.get(uri.fsPath) || [];
          arr.push(diag);
          map.set(uri.fsPath, arr);
        }
      }
    }
    // flow-诊断 4.3 end 缺失或重复：缺失贴在代表行，重复仅对后续多余项提示
    if (issues?.missingEnd) {
      // flow-诊断 4.3.1 缺失 end 的情况：在代表行提示
      if (endNodes.length === 0) {
        // flow-诊断 4.3.1.1 选取代表行（优先 step，其次 start）
        const representative = f.nodes.find(n => n.role === 'step') || f.nodes.find(n => n.role === 'start');
        if (representative) {
          // flow-诊断 4.3.1.2 计算范围并生成诊断
          const uri = vscode.Uri.file(representative.file);
          const textDoc = vscode.workspace.textDocuments.find(td => td.uri.fsPath === representative.file);
          const ln = Math.max(representative.line - 1, 0);
          const prefix = vscode.workspace.getConfiguration('flow').get<string>('prefix', 'flow')!;
          const range = prefixRange(textDoc, ln, prefix);
          const diag = new vscode.Diagnostic(range, `${f.feature} 缺失 end`, vscode.DiagnosticSeverity.Warning);
          const arr = map.get(uri.fsPath) || [];
          arr.push(diag);
          map.set(uri.fsPath, arr);
        }
      } else {
        // flow-诊断 4.3.2 处理重复 end：跳过第一个，其余逐一标记
        const dupEnds = endNodes.slice(1);
        // flow-诊断 4.3.2.1 遍历多余的 end 节点
        for (const n of dupEnds) {
          const uri = vscode.Uri.file(n.file);
          const textDoc = vscode.workspace.textDocuments.find(td => td.uri.fsPath === n.file);
          const ln = Math.max(n.line - 1, 0);
          const prefix = vscode.workspace.getConfiguration('flow').get<string>('prefix', 'flow')!;
          const range = prefixRange(textDoc, ln, prefix);
          const diag = new vscode.Diagnostic(range, `${f.feature} 重复 end`, vscode.DiagnosticSeverity.Warning);
          const arr = map.get(uri.fsPath) || [];
          arr.push(diag);
          map.set(uri.fsPath, arr);
        }
      }
    }
  }
  // flow-诊断 5 写入诊断集合：按文件批量更新 VS Code 的诊断
  for (const [file, diags] of map.entries()) {
    diagnosticCollection.set(vscode.Uri.file(file), diags);
  }
  // flow-诊断 end
}