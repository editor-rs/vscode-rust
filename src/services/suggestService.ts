import * as cp from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as tmp from 'tmp';

import PathService from './pathService';

export default class SuggestService {
    private documentSelector: [string];
    private racerDaemon: cp.ChildProcess;
    private commandCallbacks: ((lines: string[]) => void)[];
    private linesBuffer: string[];
    private tmpFile: string;
    private providers: vscode.Disposable[];
    private listeners: vscode.Disposable[];
    private racerPath: string;
    private typeMap = {
        'Struct': vscode.CompletionItemKind.Class,
        'Module': vscode.CompletionItemKind.Module,
        'MatchArm': vscode.CompletionItemKind.Variable,
        'Function': vscode.CompletionItemKind.Function,
        'Crate': vscode.CompletionItemKind.Module,
        'Let': vscode.CompletionItemKind.Variable,
        'IfLet': vscode.CompletionItemKind.Variable,
        'WhileLet': vscode.CompletionItemKind.Variable,
        'For': vscode.CompletionItemKind.Variable,
        'StructField': vscode.CompletionItemKind.Field,
        'Impl': vscode.CompletionItemKind.Class,
        'Enum': vscode.CompletionItemKind.Enum,
        'EnumVariant': vscode.CompletionItemKind.Field,
        'Type': vscode.CompletionItemKind.Keyword,
        'FnArg': vscode.CompletionItemKind.Property,
        'Trait': vscode.CompletionItemKind.Interface,
        'Const': vscode.CompletionItemKind.Variable,
        'Static': vscode.CompletionItemKind.Variable,
    };

    constructor() {
        this.documentSelector = ['rust'];
        this.listeners = [];

        let tmpFile = tmp.fileSync();
        this.tmpFile = tmpFile.name;
    }

    start(): vscode.Disposable {
        this.commandCallbacks = [];
        this.linesBuffer = [];
        this.providers = [];

        this.racerPath = PathService.getRacerPath();

        this.racerDaemon = cp.spawn(this.racerPath, ['daemon'], { stdio: 'pipe' });
        this.racerDaemon.on('error', this.stopDaemon.bind(this));
        this.racerDaemon.on('close', this.stopDaemon.bind(this));

        this.racerDaemon.stdout.on('data', this.dataHandler.bind(this));
        this.hookCapabilities();

        this.listeners.push(vscode.workspace.onDidChangeConfiguration(() => {
            let newPath = PathService.getRacerPath();
            if (this.racerPath != newPath) {
                this.restart();
            }
        }));

        return new vscode.Disposable(this.stop.bind(this));
    }

    private stopDaemon() {
        this.racerDaemon.kill();
        this.providers.forEach((disposable) => disposable.dispose());
        this.providers = [];
        vscode.window.showInformationMessage('The "racer" stopped.');
    }

    private stopListeners() {
        this.listeners.forEach((disposable) => disposable.dispose());
        this.listeners = [];
    }

    stop(): void {
        this.stopDaemon();
        this.stopListeners();
    }

    restart(): void {
        this.stop();
        this.start();
    }

    private updateTmpFile(document: vscode.TextDocument) {
        fs.writeFileSync(this.tmpFile, document.getText());
    }

    private definitionProvider(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Definition> {
        this.updateTmpFile(document);
        let command = `find-definition ${position.line + 1} ${position.character} ${document.fileName} ${this.tmpFile}\n`;
        return this.runCommand(command).then((lines) => {
            if (lines.length == 0) return null;

            let result = lines[0];
            let parts = result.split(',');
            let position = new vscode.Position(Number(parts[1]) - 1, Number(parts[2]));
            let uri = vscode.Uri.file(parts[3]);
            return new vscode.Location(uri, position);
        });
    }

    private completionProvider(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
        this.updateTmpFile(document);
        let command = `complete-with-snippet ${position.line + 1} ${position.character} ${document.fileName} ${this.tmpFile}\n`;
        return this.runCommand(command).then((lines) => {
            lines.shift();

            //Split on MATCH, as a definition can span more than one line
            lines = lines.map((l) => l.trim()).join('').split('MATCH ').slice(1);

            let completions = [];
            for (let line of lines) {
                let parts = line.split(';');
                let label = parts[0];
                let kindKey = parts[5];
                let detail = parts[6];

                let kind;
                if (kindKey in this.typeMap) {
                    kind = this.typeMap[kindKey];
                } else {
                    console.warn('Kind not mapped: ' + kindKey);
                    kind = vscode.CompletionItemKind.Text;
                }

                //Remove trailing bracket
                if (kindKey != 'Module' && kindKey != 'Crate') {
                    let bracketIndex = detail.indexOf('{');
                    if (bracketIndex == -1) bracketIndex = detail.length;
                    detail = detail.substring(0, bracketIndex).trim();
                }

                completions.push({
                    label: label,
                    kind: kind,
                    detail: detail
                });
            }

            return completions;
        });
    }

    private parseParameters(line: string, startingPosition: number, stopPosition?: number): [string[], number, number] {
        if (!stopPosition) stopPosition = line.length;

        let parameters = [];
        let currentParameter = '';
        let currentDepth = 0;
        let parameterStart = -1;
        let parameterEnd = -1;

        for (let i = startingPosition; i < stopPosition; i++) {
            let char = line.charAt(i);

            if (char == '(') {
                if (currentDepth == 0) {
                    parameterStart = i;
                }
                currentDepth += 1;
                continue;
            } else if (char == ')') {
                currentDepth -= 1;
                if (currentDepth == 0) {
                    parameterEnd = i;
                    break;
                }
                continue;
            }

            if (currentDepth == 0) continue;

            if (currentDepth == 1 && char == ',') {
                parameters.push(currentParameter);
                currentParameter = '';
            } else {
                currentParameter += char;
            }
        }

        parameters.push(currentParameter);

        return [parameters, parameterStart, parameterEnd];
    }

    private parseCall(name: string, line: string, definition: string, position: number): vscode.SignatureHelp {
        let nameEnd = definition.indexOf(name) + name.length;
        let [params, paramStart, paramEnd] = this.parseParameters(definition, nameEnd);
        let [callParameters, , ] = this.parseParameters(line, line.indexOf(name) + name.length);
        let currentParameter = callParameters.length - 1;

        let nameTemplate = definition.substring(0, paramStart);

        //If function is used as a method, ignore the self parameter
        let isMethod = line.charAt(line.indexOf(name) - 1) == '.';
        if (isMethod) params = params.slice(1);

        let result = new vscode.SignatureHelp();
        result.activeSignature = 0;
        result.activeParameter = currentParameter;

        let signature = new vscode.SignatureInformation(nameTemplate);
        signature.label += '(';

        params.forEach((param, i) => {
            let parameter = new vscode.ParameterInformation(param, '');
            signature.label += parameter.label;
            signature.parameters.push(parameter);

            if (i != params.length - 1) signature.label += ', ';
        });

        signature.label += ') ';

        let bracketIndex = definition.indexOf('{', paramEnd);
        if (bracketIndex == -1) bracketIndex = definition.length;

        //Append return type without possible trailing bracket
        signature.label += definition.substring(paramEnd + 1, bracketIndex).trim();

        result.signatures.push(signature);
        return result;
    }

    private firstDanglingParen(line: string, position: number) {
        let currentDepth = 0;
        for (let i = position; i >= 0; i--) {
            let char = line.charAt(i);
            if (char == ')') currentDepth += 1;
            else if (char == '(') currentDepth -= 1;
            if (currentDepth == -1) return i;
        }
        return -1;
    }

    private signatureHelpProvider(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.SignatureHelp> {
        this.updateTmpFile(document);
        let line = document.lineAt(position.line);

        //Get the first dangling parenthesis, so we don't stop on a function call used as a previous parameter
        let callPosition = this.firstDanglingParen(line.text, position.character - 1);
        let command = `complete-with-snippet ${position.line + 1} ${callPosition} ${document.fileName} ${this.tmpFile}\n`;
        return this.runCommand(command).then((lines) => {
            lines = lines.map((l) => l.trim()).join('').split('MATCH ').slice(1);
            if (lines.length == 0) return null;
            let parts = lines[0].split(';');
            let type = parts[5];
            if (type != 'Function') return null;
            let name = parts[0];
            let definition = parts[6];

            return this.parseCall(name, line.text, definition, position.character);
        });
    }

    private hookCapabilities(): void {
        let definitionProvider = { provideDefinition: this.definitionProvider.bind(this) };
        this.providers.push(vscode.languages.registerDefinitionProvider(this.documentSelector, definitionProvider));

        let completionProvider = { provideCompletionItems: this.completionProvider.bind(this) };
        this.providers.push(vscode.languages.registerCompletionItemProvider(this.documentSelector, completionProvider, ...['.', ':']));

        let signatureProvider = { provideSignatureHelp: this.signatureHelpProvider.bind(this) };
        this.providers.push(vscode.languages.registerSignatureHelpProvider(this.documentSelector, signatureProvider, ...['(', ',']));
    }

    private dataHandler(data: Buffer) {
        let lines = data.toString().split(/\r?\n/);
        for (let line of lines) {
            if (line.length == 0) continue;
            if (line.startsWith('END')) {
                let callback = this.commandCallbacks.shift();
                callback(this.linesBuffer);
                this.linesBuffer = [];
            } else {
                this.linesBuffer.push(line);
            }
        }
    }

    private runCommand(command: string): Promise<string[]> {
        let promise = new Promise((resolve, reject) => {
            this.commandCallbacks.push(resolve);
        });
        this.racerDaemon.stdin.write(command);
        return promise;
    }
}
