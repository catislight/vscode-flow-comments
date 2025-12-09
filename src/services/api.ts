import { Graph, Node } from '../models/types';
import { parseText as parse } from '../utils/parser';
import * as vscode from 'vscode';
import { scanWorkspace as scan, updateGraphForFile as update } from '../indexer/workspaceIndexer';
import { IndexCache } from '../indexer/cache';

export interface Parser {
  parseText(text: string, file: string, prefix: string): Node[];
}

export interface Indexer {
  scanWorkspace(cache?: IndexCache): Promise<Graph>;
  updateGraphForFile(graph: Graph, filePath: string, nodes: Node[]): Graph;
}

export const parser: Parser = {
  parseText(text: string, file: string, prefix: string): Node[] {
    const styles = vscode.workspace.getConfiguration('flow').get<string[]>('commentStyles', ['//']);
    return parse(text, file, prefix, styles);
  }
};
export const indexer: Indexer = { scanWorkspace: scan, updateGraphForFile: update };