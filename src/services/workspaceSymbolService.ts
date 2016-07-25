import * as vscode from 'vscode';
import {populateWorkspaceSymbols} from '../rustSymbols';

export default class WorkspaceSymbolService implements vscode.WorkspaceSymbolProvider {
    public provideWorkspaceSymbols(query: string/*, token: vscode.CancellationToken*/): Thenable<vscode.SymbolInformation[]> {
        return populateWorkspaceSymbols(vscode.workspace.rootPath, query);
    }
}
