/*
 * Copyright (c) 2015 "draivin" Ian Ornelas and other contributors.
 * Licensed under MIT (https://github.com/Draivin/vscode-racer/blob/master/LICENSE).
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as tmp from 'tmp';

import PathService from './pathService';
import FilterService from './filterService';

export default class SuggestService {
    private racerDaemon: cp.ChildProcess;
    private commandCallbacks: ((lines: string[]) => void)[];
    private linesBuffer: string[];
    private errorBuffer: string;
    private lastCommand: string;
    private tmpFile: string;
    private providers: vscode.Disposable[];
    private listeners: vscode.Disposable[];
    private racerPath: string;
    private typeMap: { [type: string]: vscode.CompletionItemKind } = {
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
        'Static': vscode.CompletionItemKind.Variable
    };

    constructor() {
        this.listeners = [];

        let tmpFile = tmp.fileSync();
        this.tmpFile = tmpFile.name;
    }

    public start(): vscode.Disposable {
        this.commandCallbacks = [];
        this.linesBuffer = [];
        this.errorBuffer = '';
        this.lastCommand = '';
        this.providers = [];

        this.racerPath = PathService.getRacerPath();

        this.racerDaemon = cp.spawn(PathService.getRacerPath(), ['daemon'], { stdio: 'pipe' });
        this.racerDaemon.on('error', this.stopDaemon.bind(this));
        this.racerDaemon.on('close', this.stopDaemon.bind(this));

        this.racerDaemon.stdout.on('data', this.dataHandler.bind(this));
        this.racerDaemon.stderr.on('data', (data) => this.errorBuffer += data.toString());
        this.hookCapabilities();

        this.listeners.push(vscode.workspace.onDidChangeConfiguration(() => {
            let newPath = PathService.getRacerPath();
            if (this.racerPath !== newPath) {
                this.restart();
            }
        }));

        return new vscode.Disposable(this.stop.bind(this));
    }

    public stop(): void {
        this.stopDaemon(0);
        this.stopListeners();
    }

    public restart(): void {
        this.stop();
        this.start();
    }

    private stopDaemon(error): void {
        if (this.racerDaemon == null) {
            return;
        }

        this.racerDaemon.kill();
        this.racerDaemon = null;
        this.providers.forEach(disposable => disposable.dispose());
        this.providers = [];

        if (error && error.code === 'ENOENT') {
            vscode.window.showInformationMessage('The "racer" command is not available. Make sure it is installed.');
            return;
        }

        if (error === 0) {
            return;
        }

        vscode.window.showInformationMessage('The racer process has stopped.', 'View Error')
            .then(button => {
                if (button === 'View Error') {
                    this.showErrorBuffer();
                }

                this.restart();
            });
    }

    private stopListeners(): void {
        this.listeners.forEach(disposable => disposable.dispose());
        this.listeners = [];
    }

    private showErrorBuffer(): void {
        let channel = vscode.window.createOutputChannel('Racer Error');
        channel.clear();
        channel.append(`Last command: \n${this.lastCommand}\n`);
        channel.append(`Racer Output: \n${this.linesBuffer.join('\n')}\n`);
        channel.append(`Racer Error: \n${this.errorBuffer}`);
        channel.show(2);
    }

    private updateTmpFile(document: vscode.TextDocument): void {
        fs.writeFileSync(this.tmpFile, document.getText());
    }

    private definitionProvider(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.Definition> {
        this.updateTmpFile(document);
        let command = `find-definition ${position.line + 1} ${position.character} "${document.fileName}" "${this.tmpFile}"\n`;
        return this.runCommand(command).then(lines => {
            if (lines.length === 0) {
                return null;
            }

            let result = lines[0];
            let parts = result.split(',');
            let line = Number(parts[1]) - 1;
            let character = Number(parts[2]);
            let uri = vscode.Uri.file(parts[3]);

            return new vscode.Location(uri, new vscode.Position(line, character));
        });
    }

    private completionProvider(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.CompletionItem[]> {
        this.updateTmpFile(document);
        let command = `complete-with-snippet ${position.line + 1} ${position.character} "${document.fileName}" "${this.tmpFile}"\n`;
        return this.runCommand(command).then(lines => {
            lines.shift();

            // Split on MATCH, as a definition can span more than one line
            lines = lines.map(l => l.trim()).join('').split('MATCH ').slice(1);

            let completions = [];
            for (let line of lines) {
                let parts = line.split(';');
                let label = parts[0];
                let type = parts[5];
                let detail = parts[6];

                let kind;
                if (type in this.typeMap) {
                    kind = this.typeMap[type];
                } else {
                    console.warn('Kind not mapped: ' + type);
                    kind = vscode.CompletionItemKind.Text;
                }

                // Remove trailing bracket
                if (type !== 'Module' && type !== 'Crate') {
                    let bracketIndex = detail.indexOf('{');
                    if (bracketIndex === -1) {
                        bracketIndex = detail.length;
                    }
                    detail = detail.substring(0, bracketIndex).trim();
                }

                completions.push({ label, kind, detail });
            }

            return completions;
        });
    }

    private parseParameters(line: string, startingPosition: number, stopPosition?: number): [string[], number, number] {
        if (!stopPosition) {
            stopPosition = line.length;
        }

        let parameters = [];
        let currentParameter = '';
        let currentDepth = 0;
        let parameterStart = -1;
        let parameterEnd = -1;

        for (let i = startingPosition; i < stopPosition; i++) {
            let char = line.charAt(i);

            if (char === '(') {
                if (currentDepth === 0) {
                    parameterStart = i;
                }
                currentDepth += 1;
                continue;
            } else if (char === ')') {
                currentDepth -= 1;
                if (currentDepth === 0) {
                    parameterEnd = i;
                    break;
                }
                continue;
            }

            if (currentDepth === 0) {
                continue;
            }

            if (currentDepth === 1 && char === ',') {
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
        let [callParameters] = this.parseParameters(line, line.indexOf(name) + name.length, position);
        let currentParameter = callParameters.length - 1;

        let nameTemplate = definition.substring(0, paramStart);

        // If function is used as a method, ignore the self parameter
        let isMethod = line.charAt(line.indexOf(name) - 1) === '.';
        if (isMethod) {
            params = params.slice(1);
        }

        let result = new vscode.SignatureHelp();
        result.activeSignature = 0;
        result.activeParameter = currentParameter;

        let signature = new vscode.SignatureInformation(nameTemplate);
        signature.label += '(';

        params.forEach((param, i) => {
            let parameter = new vscode.ParameterInformation(param, '');
            signature.label += parameter.label;
            signature.parameters.push(parameter);

            if (i !== params.length - 1) {
                signature.label += ', ';
            }
        });

        signature.label += ') ';

        let bracketIndex = definition.indexOf('{', paramEnd);
        if (bracketIndex === -1) {
            bracketIndex = definition.length;
        }

        // Append return type without possible trailing bracket
        signature.label += definition.substring(paramEnd + 1, bracketIndex).trim();

        result.signatures.push(signature);
        return result;
    }

    private firstDanglingParen(line: string, position: number): number {
        let currentDepth = 0;
        for (let i = position; i >= 0; i--) {
            let char = line.charAt(i);

            if (char === ')') {
                currentDepth += 1;
            } else if (char === '(') {
                currentDepth -= 1;
            }

            if (currentDepth === -1) {
                return i;
            }
        }
        return -1;
    }

    private signatureHelpProvider(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.SignatureHelp> {
        this.updateTmpFile(document);
        let line = document.lineAt(position.line);

        // Get the first dangling parenthesis, so we don't stop on a function call used as a previous parameter
        let callPosition = this.firstDanglingParen(line.text, position.character - 1);

        let command = `complete-with-snippet ${position.line + 1} ${callPosition} "${document.fileName}" "${this.tmpFile}"\n`;
        return this.runCommand(command).then((lines) => {
            lines = lines.map(l => l.trim()).join('').split('MATCH ').slice(1);
            if (lines.length === 0) {
                return null;
            }

            let parts = lines[0].split(';');
            let name = parts[0];
            let type = parts[5];
            let definition = parts[6];

            if (type !== 'Function') {
                return null;
            }

            return this.parseCall(name, line.text, definition, position.character);
        });
    }

    private hookCapabilities(): void {
        let definitionProvider = { provideDefinition: this.definitionProvider.bind(this) };
        this.providers.push(vscode.languages.registerDefinitionProvider(FilterService.getRustModeFilter(), definitionProvider));

        let completionProvider = { provideCompletionItems: this.completionProvider.bind(this) };
        this.providers.push(vscode.languages.registerCompletionItemProvider(FilterService.getRustModeFilter(),
                                                                            completionProvider, ...['.', ':']));

        let signatureProvider = { provideSignatureHelp: this.signatureHelpProvider.bind(this) };
        this.providers.push(vscode.languages.registerSignatureHelpProvider(FilterService.getRustModeFilter(),
                                                                           signatureProvider, ...['(', ',']));
    }

    private dataHandler(data: Buffer): void {
        let lines = data.toString().split(/\r?\n/);
        for (let line of lines) {
            if (line.length === 0) {
                continue;
            } else if (line.startsWith('END')) {
                let callback = this.commandCallbacks.shift();
                callback(this.linesBuffer);
                this.linesBuffer = [];
            } else {
                this.linesBuffer.push(line);
            }
        }
    }

    private runCommand(command: string): Promise<string[]> {
        this.lastCommand = command;
        let promise = new Promise(resolve => {
            this.commandCallbacks.push(resolve);
        });
        this.racerDaemon.stdin.write(command);
        return promise;
    }
}
