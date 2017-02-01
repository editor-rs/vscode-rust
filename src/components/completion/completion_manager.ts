/*
 * Copyright (c) 2015 "draivin" Ian Ornelas and other contributors.
 * Licensed under MIT (https://github.com/Draivin/vscode-racer/blob/master/LICENSE).
 */

import { ChildProcess, SpawnOptions, spawn } from 'child_process';

import { access, writeFileSync } from 'fs';

import { join } from 'path';

import {
    CompletionItem,
    CompletionItemKind,
    Definition,
    Disposable,
    ExtensionContext,
    Hover,
    Location,
    MarkedString,
    ParameterInformation,
    Position,
    Range,
    SignatureHelp,
    SignatureInformation,
    TextDocument,
    Uri,
    commands,
    languages,
    window,
    workspace
} from 'vscode';

import { fileSync } from 'tmp';

import ConfigurationManager from '../configuration/configuration_manager';

import getDocumentFilter from '../configuration/mod';

import ChildLogger from '../logging/child_logger';

import RacerStatusBarItem from './racer_status_bar_item';

export default class CompletionManager {
    private configurationManager: ConfigurationManager;

    private logger: ChildLogger;

    private racerDaemon: ChildProcess;
    private commandCallbacks: ((lines: string[]) => void)[];
    private linesBuffer: string[];
    private dataBuffer: string;
    private errorBuffer: string;
    private lastCommand: string;
    private tmpFile: string;
    private providers: Disposable[];
    private listeners: Disposable[];
    private racerPath: string;
    private typeMap: { [type: string]: CompletionItemKind } = {
        'Struct': CompletionItemKind.Class,
        'Module': CompletionItemKind.Module,
        'MatchArm': CompletionItemKind.Variable,
        'Function': CompletionItemKind.Function,
        'Crate': CompletionItemKind.Module,
        'Let': CompletionItemKind.Variable,
        'IfLet': CompletionItemKind.Variable,
        'WhileLet': CompletionItemKind.Variable,
        'For': CompletionItemKind.Variable,
        'StructField': CompletionItemKind.Field,
        'Impl': CompletionItemKind.Class,
        'Enum': CompletionItemKind.Enum,
        'EnumVariant': CompletionItemKind.Field,
        'Type': CompletionItemKind.Keyword,
        'FnArg': CompletionItemKind.Property,
        'Trait': CompletionItemKind.Interface,
        'Const': CompletionItemKind.Variable,
        'Static': CompletionItemKind.Variable
    };
    private racerStatusBarItem: RacerStatusBarItem;

    public constructor(
        context: ExtensionContext,
        configurationManager: ConfigurationManager,
        logger: ChildLogger
    ) {
        this.configurationManager = configurationManager;

        this.logger = logger;

        this.listeners = [];

        const showErrorCommandName = 'rust.racer.show_error';

        this.racerStatusBarItem = new RacerStatusBarItem(showErrorCommandName);

        context.subscriptions.push(
            commands.registerCommand(showErrorCommandName, () => {
                this.showErrorBuffer();
            })
        );

        let tmpFile = fileSync();
        this.tmpFile = tmpFile.name;

        // Set path to Rust language sources
        let rustSrcPath = configurationManager.getRustLangSrcPath();
        if (rustSrcPath) {
            process.env['RUST_SRC_PATH'] = rustSrcPath;

            context.subscriptions.push(this.start());
        } else {
            const onFulfilled = (sysroot: string) => {
                rustSrcPath = join(sysroot, 'lib', 'rustlib', 'src', 'rust', 'src');
                access(rustSrcPath, err => {
                    if (!err) {
                        process.env['RUST_SRC_PATH'] = rustSrcPath;
                    } else if (rustSrcPath.includes('.rustup')) {
                        // tslint:disable-next-line
                        const message = 'You are using rustup, but don\'t have installed source code. Do you want to install it?';
                        window.showErrorMessage(message, 'Yes').then(chosenItem => {
                            if (chosenItem === 'Yes') {
                                const terminal = window.createTerminal('Rust source code installation');
                                terminal.sendText('rustup component add rust-src');
                                terminal.show();
                            }
                        });
                    }
                    context.subscriptions.push(this.start());
                });
            };
            const onRejected = () => {
                context.subscriptions.push(this.start());
            };
            configurationManager.getRustcSysroot().then(onFulfilled, onRejected);
        }

        context.subscriptions.push(
            this.start()
        );
    }

    public start(): Disposable {
        const logger = this.logger.createChildLogger('start: ');

        logger.debug('enter');

        this.commandCallbacks = [];
        this.linesBuffer = [];
        this.dataBuffer = '';
        this.errorBuffer = '';
        this.lastCommand = '';
        this.providers = [];

        this.racerPath = this.configurationManager.getRacerPath();

        logger.debug(`racerPath=${this.racerPath}`);

        this.racerStatusBarItem.showTurnedOn();
        const cargoHomePath = this.configurationManager.getCargoHomePath();
        const racerSpawnOptions: SpawnOptions = { stdio: 'pipe', shell: true, env: process.env };
        if (cargoHomePath !== '') {
            racerSpawnOptions.env.CARGO_HOME = cargoHomePath;
        }

        logger.debug(`ENV[RUST_SRC_PATH] = ${racerSpawnOptions.env['RUST_SRC_PATH']}`);

        this.racerDaemon = spawn(
            this.racerPath,
            ['--interface=tab-text', 'daemon'],
            racerSpawnOptions
        );
        this.racerDaemon.on('error', (err: Error) => {
            this.logger.error(`racer failed: err = ${err}`);

            this.stopDaemon(err);
        });
        this.racerDaemon.on('close', (code: number, signal: string) => {
            this.logger.warning(`racer closed: code = ${code}, signal = ${signal}`);

            this.stopDaemon(code);
        });

        this.racerDaemon.stdout.on('data', (data: Buffer) => {
            this.dataHandler(data);
        });

        this.racerDaemon.stderr.on('data', (data: Buffer) => {
            this.errorBuffer += data.toString();
        });

        this.hookCapabilities();

        this.listeners.push(workspace.onDidChangeConfiguration(() => {
            const newPath = this.configurationManager.getRacerPath();

            if (this.racerPath !== newPath) {
                this.restart();
            }
        }));

        return new Disposable(this.stop.bind(this));
    }

    public stop(): void {
        this.logger.debug('stop');

        this.stopDaemon(0);
        this.stopListeners();
        this.clearCommandCallbacks();
    }

    public restart(): void {
        this.logger.warning('restart');

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
            this.racerStatusBarItem.showTurnedOff();
            return;
        }
        if (error.code === 'ENOENT') {
            this.racerStatusBarItem.showNotFound();
        } else {
            this.racerStatusBarItem.showCrashed();
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
        let channel = window.createOutputChannel('Racer Error');
        channel.clear();
        channel.append(`Last command: \n${this.lastCommand}\n`);
        channel.append(`Racer Output: \n${this.linesBuffer.join('\n')}\n`);
        channel.append(`Racer Error: \n${this.errorBuffer}`);
        channel.show(true);
    }

    private definitionProvider(document: TextDocument, position: Position): Thenable<Definition> {
        let commandArgs = [position.line + 1, position.character, document.fileName, this.tmpFile];
        return this.runCommand(document, 'find-definition', commandArgs).then(lines => {
            if (lines.length === 0) {
                return null;
            }

            let result = lines[0];
            let parts = result.split('\t');
            let line = Number(parts[2]) - 1;
            let character = Number(parts[3]);
            let uri = Uri.file(parts[4]);

            return new Location(uri, new Position(line, character));
        });
    }

    private hoverProvider(document: TextDocument, position: Position): Thenable<Hover> {
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

            let processedDocs: MarkedString[] = [{
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

            return new Hover(processedDocs);
        });
    }

    private completionProvider(document: TextDocument, position: Position): Thenable<CompletionItem[]> {
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
                    kind = CompletionItemKind.Text;
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

    private parseCall(name: string, args: string[], definition: string, callText: string): SignatureHelp {
        let nameEnd = definition.indexOf(name) + name.length;
        let [params, paramStart, paramEnd] = this.parseParameters(definition, nameEnd);
        let [callParameters] = this.parseParameters(callText, 0);
        let currentParameter = callParameters.length - 1;

        let nameTemplate = definition.substring(0, paramStart);

        // If function is used as a method, ignore the self parameter
        if ((args ? args.length : 0) < params.length) {
            params = params.slice(1);
        }

        let result = new SignatureHelp();
        result.activeSignature = 0;
        result.activeParameter = currentParameter;

        let signature = new SignatureInformation(nameTemplate);
        signature.label += '(';

        params.forEach((param, i) => {
            let parameter = new ParameterInformation(param, '');
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

    private firstDanglingParen(document: TextDocument, position: Position): Position {
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

    private signatureHelpProvider(document: TextDocument, position: Position): Thenable<SignatureHelp> {
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

            let callText = document.getText(new Range(startPos, position));
            return this.parseCall(name, args, definition, callText);
        });
    }

    private hookCapabilities(): void {
        let definitionProvider = { provideDefinition: this.definitionProvider.bind(this) };
        this.providers.push(
            languages.registerDefinitionProvider(getDocumentFilter(), definitionProvider)
        );

        let completionProvider = { provideCompletionItems: this.completionProvider.bind(this) };
        this.providers.push(
            languages.registerCompletionItemProvider(
                getDocumentFilter(),
                completionProvider,
                ...['.', ':']
            )
        );

        let signatureProvider = { provideSignatureHelp: this.signatureHelpProvider.bind(this) };
        this.providers.push(
            languages.registerSignatureHelpProvider(
                getDocumentFilter(),
                signatureProvider,
                ...['(', ',']
            )
        );

        let hoverProvider = { provideHover: this.hoverProvider.bind(this) };
        this.providers.push(languages.registerHoverProvider(getDocumentFilter(), hoverProvider));
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

    private updateTmpFile(document: TextDocument): void {
        writeFileSync(this.tmpFile, document.getText());
    }

    private runCommand(document: TextDocument, command: string, args: any[]): Promise<string[]> {
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
