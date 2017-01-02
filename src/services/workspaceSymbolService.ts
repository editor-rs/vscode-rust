import * as vscode from 'vscode';
import {populateWorkspaceSymbols} from '../rustSymbols';
import PathService from './pathService';

export default class WorkspaceSymbolService implements vscode.WorkspaceSymbolProvider {
    public provideWorkspaceSymbols(query: string/*, token: vscode.CancellationToken*/): Thenable<vscode.SymbolInformation[]> {
        return new Promise<vscode.SymbolInformation[]>((resolve, reject) => {
            PathService.cwd().then((value: string) => {
                return resolve(populateWorkspaceSymbols(value, query));
            }).catch((error: Error) => {
                vscode.window.showErrorMessage(error.message);

                reject(error.message);
            });
        });
    }
}
