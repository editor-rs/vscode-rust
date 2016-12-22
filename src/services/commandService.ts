import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import kill = require('tree-kill');
import PathService from './pathService';

import elegantSpinner = require('elegant-spinner');
const spinner = elegantSpinner();

interface CompilerMessageSpanText {
    highlight_end: number;
    highlight_start: number;
    text: string;
}

interface CompilerMessageCode {
    code: string;
    explanation: string;
}

interface CompilerMessageSpanExpansion {
    def_site_span: CompilerMessageSpan;
    macro_decl_name: string;
    span: CompilerMessageSpan;
}

interface CompilerMessageSpan {
    byte_end: number;
    byte_start: number;
    column_end: number;
    column_start: number;
    expansion?: CompilerMessageSpanExpansion;
    file_name: string;
    is_primary: boolean;
    label: string;
    line_end: number;
    line_start: number;
    suggested_replacement?: any; // I don't know what type it has
    text: CompilerMessageSpanText[];
}

interface CompilerMessage {
    children: any[]; // I don't know what type it has
    code?: CompilerMessageCode;
    level: string;
    message: string;
    rendered?: any; // I don't know what type it has
    spans: CompilerMessageSpan[];
}

interface CargoMessageTarget {
    kind: string[];
    name: string;
    src_path: string;
}

interface CargoMessageWithCompilerMessage {
    message: CompilerMessage;
    package_id: string;
    reason: 'compiler-message';
    target: CargoMessageTarget;
}

interface CargoMessageWithCompilerArtifact {
    features: any[];
    filenames: string[];
    package_id: string;
    profile: any;
    reason: 'compiler-artifact';
    target: CargoMessageTarget;
}

interface RustError {
    filename: string;
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
    severity: string;
    message: string;
}

export enum BuildType {
    Debug,
    Release
}

class ChannelWrapper {
    private channel: vscode.OutputChannel;

    constructor(channel: vscode.OutputChannel) {
        this.channel = channel;
    }

    public append(message: string): void {
        this.channel.append(message);
    }

    public clear(): void {
        this.channel.clear();
    }

    public show(): void {
        this.channel.show(true);
    }
}

export enum CheckTarget {
    Library,
    Application
}

type ExitCode = number;

class CargoTask {
    private process: cp.ChildProcess;
    private interrupted: boolean = false;

    public execute(
        args: string[],
        cwd: string,
        onStart?: () => void,
        onStdoutData?: (data: string) => void,
        onStderrData?: (data: string) => void
    ): Thenable<ExitCode> {
        return new Promise<ExitCode>((resolve, reject) => {
            const cargoPath = PathService.getCargoPath();

            if (onStart) {
                onStart();
            }

            let newEnv = Object.assign({}, process.env);

            let customEnv = vscode.workspace.getConfiguration('rust')['cargoEnv'];
            if (customEnv) {
                newEnv = Object.assign(newEnv, customEnv);
            }

            this.process = cp.spawn(cargoPath, args, { cwd, env: newEnv });

            this.process.stdout.on('data', data => {
                if (!onStdoutData) {
                    return;
                }

                let dataAsString: string = data.toString();

                onStdoutData(dataAsString);
            });
            this.process.stderr.on('data', data => {
                if (!onStderrData) {
                    return;
                }

                let dataAsString: string = data.toString();

                onStderrData(dataAsString);
            });
            this.process.on('error', error => {
                reject(error);
            });
            this.process.on('exit', code => {
                this.process.removeAllListeners();
                this.process = null;

                if (this.interrupted) {
                    reject();
                    return;
                }

                resolve(code);
            });
        });
    }

    public kill(): Thenable<any> {
        return new Promise(resolve => {
            if (!this.interrupted && this.process) {
                kill(this.process.pid, 'SIGINT', resolve);
                this.interrupted = true;
            }
        });
    }
}

export class CommandService {
    private static diagnostics: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
    private static channel: ChannelWrapper = new ChannelWrapper(vscode.window.createOutputChannel('Cargo'));
    private static currentTask: CargoTask;
    private static statusBarItem: vscode.StatusBarItem;
    private static spinnerUpdate: any;

    public static checkCommand(target: CheckTarget): vscode.Disposable {
        let commandId: string;
        switch (target) {
            case CheckTarget.Application:
                commandId = 'rust.cargo.check';
                break;
            case CheckTarget.Library:
                commandId = 'rust.cargo.check.lib';
                break;
        }
        return vscode.commands.registerCommand(commandId, () => {
            this.checkCargoCheckAvailability().then(isAvailable => {
                if (isAvailable) {
                    let args = ['check'];
                    if (target === CheckTarget.Library) {
                        args.push('--lib');
                    }
                    this.runCargo(args, true);
                } else {
                    let args = ['rustc'];
                    if (target === CheckTarget.Library) {
                        args.push('--lib');
                    }
                    args.push('--', '-Zno-trans');
                    this.runCargo(args, true);
                }
            });
        });
    }

    public static createProjectCommand(commandName: string, isBin: boolean): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.createProject(isBin);
        });
    }

    public static createBuildCommand(commandName: string, buildType: BuildType): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.buildProject(buildType);
        });
    }

    public static formatCommand(commandName: string, ...args: string[]): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.runCargo(args, true);
        });
    }

    public static buildExampleCommand(commandName: string, release: boolean): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.buildExample(release);
        });
    }

    public static runExampleCommand(commandName: string, release: boolean): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.runExample(release);
        });
    }

    public static stopCommand(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            if (this.currentTask) {
                this.currentTask.kill();
            }
        });
    }

    private static determineExampleName(): string {
        let showDocumentIsNotExampleWarning = () => {
            vscode.window.showWarningMessage('Current document is not an example');
        };
        let filePath = vscode.window.activeTextEditor.document.uri.fsPath;
        let dir = path.basename(path.dirname(filePath));
        if (dir !== 'examples') {
            showDocumentIsNotExampleWarning();
            return '';
        }
        let filename = path.basename(filePath);
        if (!filename.endsWith('.rs')) {
            showDocumentIsNotExampleWarning();
            return '';
        }
        return path.basename(filename, '.rs');
    }

    private static buildProject(buildType: BuildType): void {
        let args = ['build', '--message-format', 'json'];

        if (buildType === BuildType.Release) {
            args.push('--release');
        }

        this.runCargo(args, true);
    }

    private static buildExample(release: boolean): void {
        let exampleName = this.determineExampleName();
        if (exampleName.length === 0) {
            return;
        }
        let args = ['build', '--example', exampleName];
        if (release) {
            args.push('--release');
        }
        this.runCargo(args, true);
    }

    private static runExample(release: boolean): void {
        let exampleName = this.determineExampleName();
        if (exampleName.length === 0) {
            return;
        }
        let args = ['run', '--example', exampleName];
        if (release) {
            args.push('--release');
        }
        this.runCargo(args, true);
    }

    private static parseOutput(cwd: string, output: string): void {
        let errors: RustError[] = [];

        for (let line of output.split('\n')) {
            if (!line.startsWith('{')) {
                continue;
            }

            this.parseJsonLine(errors, line);
        }

        let mapSeverityToVsCode = (severity) => {
            if (severity === 'warning') {
                return vscode.DiagnosticSeverity.Warning;
            } else if (severity === 'error') {
                return vscode.DiagnosticSeverity.Error;
            } else if (severity === 'note') {
                return vscode.DiagnosticSeverity.Information;
            } else if (severity === 'help') {
                return vscode.DiagnosticSeverity.Hint;
            } else {
                return vscode.DiagnosticSeverity.Error;
            }
        };

        this.diagnostics.clear();

        let diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();
        errors.forEach(error => {
            let filePath = path.join(cwd, error.filename);
            // VSCode starts its lines and columns at 0, so subtract 1 off 
            let range = new vscode.Range(error.startLine - 1, error.startCharacter - 1, error.endLine - 1, error.endCharacter - 1);
            let severity = mapSeverityToVsCode(error.severity);

            let diagnostic = new vscode.Diagnostic(range, error.message, severity);
            let diagnostics = diagnosticMap.get(filePath);
            if (!diagnostics) {
                diagnostics = [];
            }
            diagnostics.push(diagnostic);

            diagnosticMap.set(filePath, diagnostics);
        });

        diagnosticMap.forEach((diags, uri) => {
            const uniqueDiagnostics = this.getUniqueDiagnostics(diags);
            this.diagnostics.set(vscode.Uri.file(uri), uniqueDiagnostics);
        });
    }

    private static getUniqueDiagnostics(diagnostics: vscode.Diagnostic[]): vscode.Diagnostic[] {
        let uniqueDiagnostics: vscode.Diagnostic[] = [];

        for (let diagnostic of diagnostics) {
            const uniqueDiagnostic = uniqueDiagnostics.find(uniqueDiagnostic => {
                if (!diagnostic.range.isEqual(uniqueDiagnostic.range)) {
                    return false;
                }

                if (diagnostic.message !== uniqueDiagnostic.message) {
                    return false;
                }

                return true;
            });

            if (uniqueDiagnostic === undefined) {
                uniqueDiagnostics.push(diagnostic);
            }
        }

        return uniqueDiagnostics;
    }

    private static checkCargoCheckAvailability(): Thenable<boolean> {
        let args = ['check', '--help'];
        let cwd = '/'; // Doesn't matter.
        return (new CargoTask).execute(args, cwd).then((exitCode: ExitCode) => {
            return exitCode === 0;
        });
    }

    public static parseJsonLine(errors: RustError[], line: string): boolean {
        const errorJson: CargoMessageWithCompilerArtifact | CargoMessageWithCompilerMessage = JSON.parse(line);

        if (errorJson.reason !== 'compiler-message') {
            return false;
        }

        return this.parseCargoMessage(errors, errorJson);
    }

    private static parseCargoMessage(errors: RustError[], cargoMessage: CargoMessageWithCompilerMessage): boolean {
        const compilerMessage = cargoMessage.message;
        const spans = compilerMessage.spans;

        if (spans.length === 0) {
            return false;
        }

        // Only add the primary span, as VSCode orders the problem window by the
        // error's range, which causes a lot of confusion if there are duplicate messages.
        let primarySpan = spans.find(span => span.is_primary);

        if (!primarySpan) {
            return false;
        }

        // Following macro expansion to get correct file name and range.
        while (primarySpan.expansion && primarySpan.expansion.span) {
            primarySpan = primarySpan.expansion.span;
        }

        let error: RustError = {
            filename: primarySpan.file_name,
            startLine: primarySpan.line_start,
            startCharacter: primarySpan.column_start,
            endLine: primarySpan.line_end,
            endCharacter: primarySpan.column_end,
            severity: compilerMessage.level,
            message: compilerMessage.message
        };

        if (compilerMessage.code) {
            error.message = `${compilerMessage.code.code}: ${error.message}`;
        }


        error.message = addNotesToMessage(error.message, compilerMessage.children, 1);
        errors.push(error);

        return true;
    }

    private static showSpinner(): void {
        if (this.statusBarItem == null) {
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            this.statusBarItem.text = spinner();
            this.statusBarItem.tooltip = 'Running Cargo Task';
        }

        this.statusBarItem.show();

        if (this.spinnerUpdate == null) {
            this.spinnerUpdate = setInterval(() => {
                this.statusBarItem.text = spinner();
            }, 50);
        }
    }

    private static hideSpinner(): void {
        if (this.spinnerUpdate != null) {
            clearInterval(this.spinnerUpdate);
            this.spinnerUpdate = null;
        }

        if (this.statusBarItem != null) {
            this.statusBarItem.hide();
        }
    }

    private static createProject(isBin: boolean): void {
        let cwd = vscode.workspace.rootPath;
        if (!cwd) {
            vscode.window.showErrorMessage('Current document not in the workspace');
            return;
        }
        const projectType = isBin ? 'executable' : 'library';
        const placeHolder = `Enter ${projectType} project name`;
        vscode.window.showInputBox({ placeHolder: placeHolder }).then((name: string) => {
            if (!name || name.length === 0) {
                return;
            }

            let args = ['new', name];
            if (isBin) {
                args.push('--bin');
            } else {
                args.push('--lib');
            }

            this.currentTask = new CargoTask();

            this.channel.clear();

            {
                const rustConfig = vscode.workspace.getConfiguration('rust');
                if (rustConfig['showOutput']) {
                    this.channel.show();
                }
            }
            let onData = (data: string) => {
                this.channel.append(data);
            };
            let onStart = undefined;
            let onStdoutData = onData;
            let onStderrData = onData;
            this.currentTask.execute(args, cwd, onStart, onStdoutData, onStderrData).then(() => {
                this.currentTask = null;
            });
        });
    }

    private static runCargo(args: string[], force = false): void {
        if (force && this.currentTask) {
            this.currentTask.kill().then(() => {
                this.runCargo(args, force);
            });
            return;
        } else if (this.currentTask) {
            return;
        }

        this.currentTask = new CargoTask();

        {
            const rustConfig = vscode.workspace.getConfiguration('rust');
            if (rustConfig['showOutput']) {
                this.channel.show();
            }
        }

        PathService.cwd().then((value: string | Error) => {
            if (typeof value === 'string') {
                this.showSpinner();

                const cwd = value;

                args = this.addFeaturesToArgs(args);

                let startTime: number;

                let onStart = () => {
                    startTime = Date.now();

                    this.channel.clear();
                    this.channel.append(`Started cargo ${args.join(' ')}\n`);
                };

                let output = '';

                let onData = (data: string) => {
                    output += data;
                };

                let onStdoutData = onData;

                let onStderrData = onData;

                let onGracefullyEnded = (exitCode: ExitCode) => {
                    this.hideSpinner();

                    this.currentTask = null;

                    const endTime = Date.now();

                    // If the user has selected JSON errors, we need to parse and print them into something human readable
                    // It might not match Rust 1-to-1, but its better than JSON
                    this.parseOutput(cwd, output);

                    for (const line of output.split('\n')) {
                        // Catch any JSON lines
                        if (line.startsWith('{')) {
                            let errors: RustError[] = [];
                            if (CommandService.parseJsonLine(errors, line)) {
                                /* tslint:disable:max-line-length */
                                // Print any errors as best we can match to Rust's format.
                                // TODO: Add support for child errors/text highlights.
                                // TODO: The following line will currently be printed fine, but the two lines after will not.
                                // src\main.rs:5:5: 5:8 error: expected one of `!`, `.`, `::`, `;`, `?`, `{`, `}`, or an operator, found `let`
                                // src\main.rs:5     let mut a = 4;
                                //                   ^~~
                                /* tslint:enable:max-line-length */
                                for (const error of errors) {
                                    this.channel.append(`${error.filename}:${error.startLine}:${error.startCharacter}:` +
                                        ` ${error.severity}: ${error.message}\n`);
                                }
                            }
                        } else {
                            // Catch any non-JSON lines like "Compiling <project> (<path>)"
                            this.channel.append(`${line}\n`);
                        }
                    }

                    this.channel.append(`Completed with code ${exitCode}\n`);
                    this.channel.append(`It took approximately ${(endTime - startTime) / 1000} seconds\n`);
                };

                let onUnexpectedlyEnded = (error?: Error) => {
                    this.hideSpinner();

                    this.currentTask = null;

                    // No error means the task has been interrupted
                    if (!error) {
                        return;
                    }

                    if (error.message !== 'ENOENT') {
                        return;
                    }

                    vscode.window.showInformationMessage('The "cargo" command is not available. Make sure it is installed.');
                };

                this.currentTask.execute(args, cwd, onStart, onStdoutData, onStderrData).then(onGracefullyEnded, onUnexpectedlyEnded);
            } else {
                vscode.window.showErrorMessage(value.message);
            }
        });
    }

    private static addFeaturesToArgs(args: string[]): string[] {
        const rustConfig = vscode.workspace.getConfiguration('rust');
        const featureArray = rustConfig['features'];

        if (featureArray.length === 0) {
            return args;
        }

        const featuresArgs = ['--features'].concat(featureArray);

        // replace args with new instance containing feature flags, features
        // must be placed before doubledash `--`
        let doubleDashIndex = args.indexOf('--');
        if (doubleDashIndex >= 0) {
            let argsBeforeDoubleDash = args.slice(0, doubleDashIndex);
            let argsAfterDoubleDash = args.slice(doubleDashIndex);
            return argsBeforeDoubleDash.concat(featuresArgs, argsAfterDoubleDash);
        } else {
            return args.concat(featuresArgs);
        }
    }
}

function addNotesToMessage(msg: string, children: any[], level: number): string {
    const ident = '   '.repeat(level);
    for (let child of children) {
        msg += `\n${ident}${child.message}`;
        if (child.spans && child.spans.length > 0) {
            msg += ': ';
            let lines = [];
            for (let span of child.spans) {
                if (!span.file_name || !span.line_start) {
                    continue;
                }
                lines.push(`${span.file_name}(${span.line_start})`);
            }
            msg += lines.join(', ');
        }
        if (child.children) {
            msg = addNotesToMessage(msg, child.children, level + 1);
        }
    }
    return msg;
}
