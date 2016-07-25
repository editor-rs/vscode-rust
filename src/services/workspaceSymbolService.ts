import * as vscode from 'vscode';
import {populateWorkspaceSymbols} from '../rustSymbols';
import PathService from './pathService';

export default class WorkspaceSymbolService implements vscode.WorkspaceSymbolProvider {
    public provideWorkspaceSymbols(query: string/*, token: vscode.CancellationToken*/): Thenable<vscode.SymbolInformation[]> {
        return new Promise<vscode.SymbolInformation[]>((resolve, reject) => {
            PathService.cwd().then((value: string | Error) => {
                if (typeof value === 'string') {
                    return resolve(populateWorkspaceSymbols(value, query));
                } else {
                    vscode.window.showErrorMessage(value.message);

                    return reject(value.message);
                }
            });
        });
    }
}
