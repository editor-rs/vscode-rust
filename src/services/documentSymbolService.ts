import * as vscode from 'vscode';
import {populateDocumentSymbols} from '../rustSymbols';

export default class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(document: vscode.TextDocument/*, token: vscode.CancellationToken*/):
        Thenable<vscode.SymbolInformation[]> {
        return populateDocumentSymbols(document.fileName);
    }
}
