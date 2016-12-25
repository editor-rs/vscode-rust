import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as readline from 'readline';
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
        onStdoutLine?: (data: string) => void,
        onStderrLine?: (data: string) => void
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

            const stdout = readline.createInterface({ input: this.process.stdout });
            stdout.on('line', line => {
                if (!onStdoutLine) {
                    return;
                }

                onStdoutLine(line);
            });
            const stderr = readline.createInterface({ input: this.process.stderr });
            stderr.on('line', line => {
                if (!onStderrLine) {
                    return;
                }

                onStderrLine(line);
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

    public static createCheckCommand(commandName: string, target: CheckTarget): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.checkProject(target);
        });
    }

    public static createClippyCommand(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.checkProjectWithClippy();
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

    public static createRunCommand(commandName: string, buildType: BuildType): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.runProject(buildType);
        });
    }

    public static createTestCommand(commandName: string, buildType: BuildType): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.testProject(buildType);
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

    private static getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('rust');
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
        const args = ['build', '--message-format', 'json'];

        if (buildType === BuildType.Release) {
            args.push('--release');
        }

        const configuration = this.getConfiguration();
        const userDefinedArgs: string[] = configuration.get<string[]>('buildArgs');

        args.push(...userDefinedArgs);

        this.runCargo(args, true);
    }

    private static checkProject(target: CheckTarget): void {
        this.checkCargoCheckAvailability().then(isAvailable => {
            let args: string[];

            if (isAvailable) {
                args = ['check'];

                if (target === CheckTarget.Library) {
                    args.push('--lib');
                }

                const configuration = this.getConfiguration();
                const userDefinedArgs: string[] = configuration.get<string[]>('checkArgs');

                args.push(...userDefinedArgs);
            } else {
                args = ['rustc'];

                if (target === CheckTarget.Library) {
                    args.push('--lib');
                }

                args.push('--', '-Zno-trans');
            }

            this.runCargo(args, true);
        });
    }

    private static checkProjectWithClippy(): void {
        const args = ['clippy'];

        const configuration = this.getConfiguration();
        const userDefinedArgs: string[] = configuration.get<string[]>('clippyArgs');

        args.push(...userDefinedArgs);

        this.runCargo(args, true);
    }

    private static runProject(buildType: BuildType): void {
        const args = ['run'];

        if (buildType === BuildType.Release) {
            args.push('--release');
        }

        const configuration = this.getConfiguration();
        const userDefinedArgs: string[] = configuration.get<string[]>('runArgs');

        args.push(...userDefinedArgs);

        this.runCargo(args, true);
    }

    private static testProject(buildType: BuildType): void {
        const args = ['test'];

        if (buildType === BuildType.Release) {
            args.push('--release');
        }

        const configuration = this.getConfiguration();
        const userDefinedArgs: string[] = configuration.get<string[]>('testArgs');

        args.push(...userDefinedArgs);

        this.runCargo(args, true);
    }

    private static buildExample(release: boolean): void {
        const exampleName = this.determineExampleName();

        if (exampleName.length === 0) {
            return;
        }

        const args = ['build', '--example', exampleName];

        if (release) {
            args.push('--release');
        }

        const configuration = this.getConfiguration();
        const userDefinedArgs: string[] = configuration.get<string[]>('buildArgs');

        args.push(...userDefinedArgs);

        this.runCargo(args, true);
    }

    private static runExample(release: boolean): void {
        const exampleName = this.determineExampleName();

        if (exampleName.length === 0) {
            return;
        }

        const args = ['run', '--example', exampleName];

        if (release) {
            args.push('--release');
        }

        const configuration = this.getConfiguration();
        const userDefinedArgs: string[] = configuration.get<string[]>('runArgs');

        args.push(...userDefinedArgs);

        this.runCargo(args, true);
    }

    private static updateDiagnostics(cwd: string, errors: RustError[]): void {
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
        this.diagnostics.clear();

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
            let onLine = (line: string) => {
                this.channel.append(`${line}\n`);
            };
            let onStart = undefined;
            let onStdoutLine = onLine;
            let onStderrLine = onLine;
            this.currentTask.execute(args, cwd, onStart, onStdoutLine, onStderrLine).then(() => {
                this.currentTask = null;
            });
        });
    }

    private static runCargo(args: string[], force = false): void {
        this.diagnostics.clear();

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

                let startTime: number;

                let onStart = () => {
                    startTime = Date.now();

                    this.channel.clear();
                    this.channel.append(`Started cargo ${args.join(' ')}\n`);
                };

                let errors: RustError[] = [];
                let onStdoutLine = (line: string) => {
                    if (line.startsWith('{')) {
                        let newErrors: RustError[] = [];
                        if (CommandService.parseJsonLine(newErrors, line)) {
                            /* tslint:disable:max-line-length */
                            // Print any errors as best we can match to Rust's format.
                            // TODO: Add support for child errors/text highlights.
                            // TODO: The following line will currently be printed fine, but the two lines after will not.
                            // src\main.rs:5:5: 5:8 error: expected one of `!`, `.`, `::`, `;`, `?`, `{`, `}`, or an operator, found `let`
                            // src\main.rs:5     let mut a = 4;
                            //                   ^~~
                            /* tslint:enable:max-line-length */
                            for (const error of newErrors) {
                                this.channel.append(`${error.filename}:${error.startLine}:${error.startCharacter}:` +
                                    ` ${error.severity}: ${error.message}\n`);
                            }

                            errors = errors.concat(newErrors);
                            this.updateDiagnostics(cwd, errors);
                        }
                    } else {
                        this.channel.append(`${line}\n`);
                    }
                };

                let onStderrLine = (line: string) => {
                    this.channel.append(`${line}\n`);
                };

                let onGracefullyEnded = (exitCode: ExitCode) => {
                    this.hideSpinner();

                    this.currentTask = null;

                    const endTime = Date.now();
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

                this.currentTask.execute(args, cwd, onStart, onStdoutLine, onStderrLine).then(onGracefullyEnded, onUnexpectedlyEnded);
            } else {
                vscode.window.showErrorMessage(value.message);
            }
        });
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
