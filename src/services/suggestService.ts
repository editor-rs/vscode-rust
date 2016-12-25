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

class StatusBarItem {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }

    public showTurnedOn(): void {
        this.setText('On');
        this.statusBarItem.command = null;
        this.statusBarItem.show();
    }

    public showTurnedOff(): void {
        this.setText('Off');
        this.statusBarItem.command = null;
        this.statusBarItem.show();
    }

    public showNotFound(): void {
        this.setText('Not found');
        this.statusBarItem.tooltip = 'The "racer" command is not available. Make sure it is installed.';
        this.statusBarItem.command = null;
        this.statusBarItem.show();
    }

    public showCrashed(): void {
        this.setText('Crashed');
        this.statusBarItem.tooltip = 'The racer process has stopped. Click to view error';
        this.statusBarItem.command = 'rust.racer.showerror';
        this.statusBarItem.show();
    }

    private setText(text: string): void {
        this.statusBarItem.text = `Racer: ${text}`;
    }
}

export default class SuggestService {
    private racerDaemon: cp.ChildProcess;
    private commandCallbacks: ((lines: string[]) => void)[];
    private linesBuffer: string[];
    private dataBuffer: string;
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
    private statusBarItem: StatusBarItem;

    constructor() {
        this.listeners = [];
        this.statusBarItem = new StatusBarItem();
        let tmpFile = tmp.fileSync();
        this.tmpFile = tmpFile.name;
    }

    public racerCrashErrorCommand(command: string): vscode.Disposable {
        return vscode.commands.registerCommand(command, () => {
            this.showErrorBuffer();
        });
    }

    public start(): vscode.Disposable {
        this.commandCallbacks = [];
        this.linesBuffer = [];
        this.dataBuffer = '';
        this.errorBuffer = '';
        this.lastCommand = '';
        this.providers = [];

        this.racerPath = PathService.getRacerPath();
        this.statusBarItem.showTurnedOn();
        const cargoHomePath = PathService.getCargoHomePath();
        const racerSpawnOptions: cp.SpawnOptions = { stdio: 'pipe' };
        if (cargoHomePath !== '') {
            const racerEnv = Object.assign({}, process.env, {'CARGO_HOME': cargoHomePath});
            racerSpawnOptions.env = racerEnv;
        }

        this.racerDaemon = cp.spawn(PathService.getRacerPath(), ['--interface=tab-text', 'daemon'], racerSpawnOptions);
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
        this.clearCommandCallbacks();
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
        if (!error) {
            this.statusBarItem.showTurnedOff();
            return;
        }
        if (error.code === 'ENOENT') {
            this.statusBarItem.showNotFound();
        } else {
            this.statusBarItem.showCrashed();
            setTimeout(this.restart.bind(this), 3000);
        }
    }

    private stopListeners(): void {
        this.listeners.forEach(disposable => disposable.dispose());
        this.listeners = [];
    }

    private clearCommandCallbacks(): void {
        this.commandCallbacks.forEach(callback => callback([]));
    }

    private showErrorBuffer(): void {
        let channel = vscode.window.createOutputChannel('Racer Error');
        channel.clear();
        channel.append(`Last command: \n${this.lastCommand}\n`);
        channel.append(`Racer Output: \n${this.linesBuffer.join('\n')}\n`);
        channel.append(`Racer Error: \n${this.errorBuffer}`);
        channel.show(true);
    }

    private definitionProvider(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.Definition> {
        let commandArgs = [position.line + 1, position.character, document.fileName, this.tmpFile];
        return this.runCommand(document, 'find-definition', commandArgs).then(lines => {
            if (lines.length === 0) {
                return null;
            }

            let result = lines[0];
            let parts = result.split('\t');
            let line = Number(parts[2]) - 1;
            let character = Number(parts[3]);
            let uri = vscode.Uri.file(parts[4]);

            return new vscode.Location(uri, new vscode.Position(line, character));
        });
    }

    private hoverProvider(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.Hover> {
        // Could potentially use `document.getWordRangeAtPosition`.
        let line = document.lineAt(position.line);
        let wordStartIndex = line.text.slice(0, position.character + 1).search(/[a-z0-9_]+$/i);
        let lastCharIndex = line.text.slice(position.character).search(/[^a-z0-9_]/i);
        let wordEndIndex = lastCharIndex === -1 ? 1 + position.character : lastCharIndex + position.character;
        let lineTail = line.text.slice(wordEndIndex).trim();
        let isFunction = lineTail === '' ? false : lineTail[0] === '(';

        let word = line.text.slice(wordStartIndex, wordEndIndex);
        if (!word) {
            return null;
        }

        // We are using `complete-with-snippet` instead of `find-definition` because it contains
        // extra information that is not contained in the `find`definition` command, such as documentation.
        let commandArgs = [position.line + 1, wordEndIndex, document.fileName, this.tmpFile];
        return this.runCommand(document, 'complete-with-snippet', commandArgs).then(lines => {
            if (lines.length <= 1) {
                return null;
            }

            let results = lines.slice(1).map(x => x.split('\t'));
            let result =
                isFunction
                    ? results.find(parts => parts[2].startsWith(word + '(') && parts[6] === 'Function')
                    : results.find(parts => parts[2] === word);

            // We actually found a completion instead of a definition, so we won't show the returned info.
            if (result == null) {
                return null;
            }

            let match = result[2];
            let type = result[6];
            let definition = type === 'Module' ? 'module ' + match : result[7];
            let docs = JSON.parse(result[8].replace(/\\'/g, "'")).split('\n');

            let bracketIndex = definition.indexOf('{');
            if (bracketIndex !== -1) {
                definition = definition.substring(0, bracketIndex);
            }

            let processedDocs: vscode.MarkedString[] = [{
                language: 'rust',
                value: definition.trim()
            }];

            let currentBlock: string[] = [];
            let codeBlock = false;
            let extraIndent = 0;

            // The logic to push a block to the processed blocks is a little
            // contrived, depending on if we are inside a language block or not,
            // as the logic has to be repeated at the end of the for block, I
            // preferred to extract it to an inline function.
            function pushBlock(): void {
                if (codeBlock) {
                    processedDocs.push({
                        language: 'rust',
                        value: currentBlock.join('\n')
                    });
                } else {
                    processedDocs.push(currentBlock.join('\n'));
                }
            }

            for (let i = 0; i < docs.length; i++) {
                let docLine = docs[i];

                if (docLine.trim().startsWith('```')) {
                    if (currentBlock.length) {
                        pushBlock();
                        currentBlock = [];
                    }
                    codeBlock = !codeBlock;
                    extraIndent = docLine.indexOf('```');
                    continue;
                }

                if (codeBlock) {
                    if (!docLine.trim().startsWith('# ')) {
                        currentBlock.push(docLine.slice(extraIndent));
                    }
                    continue;
                }

                // When this was implemented (vscode 1.5.1), the markdown headers
                // were a little buggy, with a large margin-botton that pushes the
                // next line far down. As an alternative, I replaced the headers
                // with links (that lead to nowhere), just so there is some highlight.
                //
                // The preferred alternative would be to just make the headers a little
                // smaller and otherwise draw them as is.
                if (docLine.trim().startsWith('#')) {
                    let headerMarkupEnd = docLine.trim().search(/[^# ]/);
                    currentBlock.push('[' + docLine.trim().slice(headerMarkupEnd) + ']()');

                    continue;
                }

                currentBlock.push(docLine);
            }

            if (currentBlock.length) {
                pushBlock();
            }

            return new vscode.Hover(processedDocs);
        });
    }

    private completionProvider(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.CompletionItem[]> {
        let commandArgs = [position.line + 1, position.character, document.fileName, this.tmpFile];
        return this.runCommand(document, 'complete-with-snippet', commandArgs).then(lines => {
            lines.shift();

            // Split on MATCH, as a definition can span more than one line
            lines = lines.map(l => l.trim()).join('').split('MATCH\t').slice(1);

            let completions = [];
            for (let line of lines) {
                let parts = line.split('\t');
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

    private parseParameters(text: string, startingPosition: number): [string[], number, number] {

        let stopPosition = text.length;
        let parameters = [];
        let currentParameter = '';
        let currentDepth = 0;
        let parameterStart = -1;
        let parameterEnd = -1;

        for (let i = startingPosition; i < stopPosition; i++) {
            let char = text.charAt(i);

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

    private parseCall(name: string, args: string[], definition: string, callText: string): vscode.SignatureHelp {
        let nameEnd = definition.indexOf(name) + name.length;
        let [params, paramStart, paramEnd] = this.parseParameters(definition, nameEnd);
        let [callParameters] = this.parseParameters(callText, 0);
        let currentParameter = callParameters.length - 1;

        let nameTemplate = definition.substring(0, paramStart);

        // If function is used as a method, ignore the self parameter
        if ((args ? args.length : 0) < params.length) {
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

    private firstDanglingParen(document: vscode.TextDocument, position: vscode.Position): vscode.Position {
        let text = document.getText();
        let offset = document.offsetAt(position) - 1;
        let currentDepth = 0;

        while (offset > 0) {
            let char = text.charAt(offset);

            if (char === ')') {
                currentDepth += 1;
            } else if (char === '(') {
                currentDepth -= 1;
            } else if (char === '{') {
                return null; // not inside function call
            }

            if (currentDepth === -1) {
                return document.positionAt(offset);
            }

            offset--;
        }

        return null;
    }

    private signatureHelpProvider(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.SignatureHelp> {
        // Get the first dangling parenthesis, so we don't stop on a function call used as a previous parameter
        let startPos = this.firstDanglingParen(document, position);
        if (!startPos) {
            return null;
        }

        let name = document.getText(document.getWordRangeAtPosition(startPos));

        let commandArgs = [startPos.line + 1, startPos.character - 1, document.fileName, this.tmpFile];
        return this.runCommand(document, 'complete-with-snippet', commandArgs).then((lines) => {
            lines = lines.map(l => l.trim()).join('').split('MATCH\t').slice(1);

            let parts: string[] = [];
            for (let line of lines) {
                parts = line.split('\t');
                if (parts[0] === name) {
                    break;
                }
            }

            if (parts[0] !== name) {
                return null;
            }

            let args = parts[1].match(/\${\d+:\w+}/g);
            let type = parts[5];
            let definition = parts[6];

            if (type !== 'Function') {
                return null;
            }

            let callText = document.getText(new vscode.Range(startPos, position));
            return this.parseCall(name, args, definition, callText);
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

        let hoverProvider = { provideHover: this.hoverProvider.bind(this) };
        this.providers.push(vscode.languages.registerHoverProvider(FilterService.getRustModeFilter(), hoverProvider));
    }

    private dataHandler(data: Buffer): void {
        // Ensure we only start parsing when the whole line has been flushed.
        // It can happen that when a line goes over a certain length, racer will
        // flush it one part at a time, if we don't wait for the whole line to
        // be flushed, we will consider each part of the original line a separate
        // line.
        let dataStr = data.toString();
        if (!/\r?\n$/.test(dataStr)) {
            this.dataBuffer += dataStr;
            return;
        }

        let lines = (this.dataBuffer + dataStr).split(/\r?\n/);
        this.dataBuffer = '';

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

    private updateTmpFile(document: vscode.TextDocument): void {
        fs.writeFileSync(this.tmpFile, document.getText());
    }

    private runCommand(document: vscode.TextDocument, command: string, args: any[]): Promise<string[]> {
        this.updateTmpFile(document);

        let queryString = [command, ...args].join('\t') + '\n';

        this.lastCommand = queryString;
        let promise = new Promise(resolve => {
            this.commandCallbacks.push(resolve);
        });

        this.racerDaemon.stdin.write(queryString);
        return promise;
    }
}
