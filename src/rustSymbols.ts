import * as vscode from 'vscode';
import * as cp from 'child_process';
import PathService from './services/pathService';

const rustKindToCodeKind: { [key: string]: vscode.SymbolKind } = {
    'struct': vscode.SymbolKind.Class,
    'method': vscode.SymbolKind.Method,
    'field': vscode.SymbolKind.Field,
    'function': vscode.SymbolKind.Function,
    'constant': vscode.SymbolKind.Constant,
    'static': vscode.SymbolKind.Constant,
    'enum': vscode.SymbolKind.Enum
};

function getSymbolKind(kind: string): vscode.SymbolKind {
    let symbolKind: vscode.SymbolKind;
    if (kind !== '') {
        symbolKind = rustKindToCodeKind[kind];
    }

    return symbolKind;
}

interface RustSymbol {
    path: string;
    name: string;
    container: string;
    kind: string;
    line: number;
}

function resultToSymbols(json: string): vscode.SymbolInformation[] {
    let decls = <RustSymbol[]>JSON.parse(json);

    let symbols: vscode.SymbolInformation[] = [];

    decls.forEach(decl => {
        let pos = new vscode.Position(decl.line - 1, 0);
        let kind = getSymbolKind(decl.kind);

        let symbol = new vscode.SymbolInformation(
            decl.name,
            kind,
            new vscode.Range(pos, pos),
            vscode.Uri.file(decl.path),
            decl.container);

        symbols.push(symbol);
    });

    return symbols;
}

export function populateDocumentSymbols(documentPath: string): Promise<vscode.SymbolInformation[]> {
    return new Promise<vscode.SymbolInformation[]>((resolve, reject) => {
        cp.execFile(
            PathService.getRustsymPath(),
            ['search', '-l', documentPath], {}, (err, stdout/*, stderr*/) => {
                try {
                  if (err && (<any>err).code === 'ENOENT') {
                        vscode.window.showInformationMessage('The "rustsym" command is not available. Make sure it is installed.');
                        return resolve([]);
                    }

                    let result = stdout.toString();
                    let symbols = resultToSymbols(result);

                    return resolve(symbols);
                } catch (e) {
                    reject(e);
                }
            });
    });
}

export function populateWorkspaceSymbols(workspaceRoot: string, query: string): Promise<vscode.SymbolInformation[]> {
    return new Promise<vscode.SymbolInformation[]>((resolve, reject) => {
        cp.execFile(
            PathService.getRustsymPath(),
            ['search', '-g', workspaceRoot, query], { maxBuffer: 1024 * 1024 }, (err, stdout/*, stderr*/) => {
                try {
                  if (err && (<any>err).code === 'ENOENT') {
                        vscode.window.showInformationMessage('The "rustsym" command is not available. Make sure it is installed.');
                        return resolve([]);
                    }

                    let result = stdout.toString();
                    let symbols = resultToSymbols(result);

                    return resolve(symbols);
                } catch (e) {
                    reject(e);
                }
            });
    });
}
