import * as vscode from 'vscode';
import {populateWorkspaceSymbols} from '../rustSymbols';
import PathService from './pathService';

export default class WorkspaceSymbolService implements vscode.WorkspaceSymbolProvider {
    public provideWorkspaceSymbols(query: string/*, token: vscode.CancellationToken*/): Thenable<vscode.SymbolInformation[]> {
        return new Promise<vscode.SymbolInformation[]>((resolve, reject) => {
            PathService.cwd().then((result: string) => {
                return resolve(populateWorkspaceSymbols(result, query));
            }, (err: Error) => {
                return reject(err.message);
            });
        });
    }
}
