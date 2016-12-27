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

            const configuration = getConfiguration();
            const customEnv = configuration['cargoEnv'];

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

class CargoTaskArgs {
    private args: string[];

    public constructor(command: string) {
        this.args = [command];
    }

    public setMessageFormatToJson(): void {
        this.args.push('--message-format', 'json');
    }

    public setBuildTypeToReleaseIfRequired(buildType: BuildType): void {
        if (buildType !== BuildType.Release) {
            return;
        }

        this.args.push('--release');
    }

    public addArg(arg: string): void {
        this.args.push(arg);
    }

    public addArgs(args: string[]): void {
        this.args.push(...args);
    }

    public getArgs(): string[] {
        return this.args;
    }
}

class UserDefinedArgs {
    public static getBuildArgs(): string[] {
        const args = UserDefinedArgs.getArgs('buildArgs');

        return args;
    }

    public static getCheckArgs(): string[] {
        const args = UserDefinedArgs.getArgs('checkArgs');

        return args;
    }

    public static getClippyArgs(): string[] {
        const args = UserDefinedArgs.getArgs('clippyArgs');

        return args;
    }

    public static getRunArgs(): string[] {
        const args = UserDefinedArgs.getArgs('runArgs');

        return args;
    }

    public static getTestArgs(): string[] {
        const args = UserDefinedArgs.getArgs('testArgs');

        return args;
    }

    private static getArgs(property: string): string[] {
        const configuration = getConfiguration();
        const args = configuration.get<string[]>(property);

        return args;
    }
}

class CargoManager {
    private diagnostics: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
    private channel: ChannelWrapper = new ChannelWrapper(vscode.window.createOutputChannel('Cargo'));
    private currentTask: CargoTask;
    private statusBarItem: vscode.StatusBarItem;
    private spinnerUpdate: any;

    public invokeCargoBuildWithArgs(additionalArgs: string[]): void {
        const argsBuilder = new CargoTaskArgs('build');
        argsBuilder.setMessageFormatToJson();
        argsBuilder.addArgs(additionalArgs);

        const args = argsBuilder.getArgs();

        this.runCargo(args, true);
    }

    public invokeCargoBuildUsingBuildArgs(): void {
        this.invokeCargoBuildWithArgs(UserDefinedArgs.getBuildArgs());
    }

    public invokeCargoCheckWithArgs(additionalArgs: string[]): void {
        this.checkCargoCheckAvailability().then(isAvailable => {
            let argsBuilder: CargoTaskArgs;

            if (isAvailable) {
                argsBuilder = new CargoTaskArgs('check');
                argsBuilder.setMessageFormatToJson();
                argsBuilder.addArgs(additionalArgs);
            } else {
                argsBuilder = new CargoTaskArgs('rustc');
                argsBuilder.setMessageFormatToJson();
                argsBuilder.addArgs(additionalArgs);
                argsBuilder.addArgs(['--', '-Zno-trans']);
            }

            const args = argsBuilder.getArgs();

            this.runCargo(args, true);
        });
    }

    public invokeCargoCheckUsingCheckArgs(): void {
        this.invokeCargoCheckWithArgs(UserDefinedArgs.getCheckArgs());
    }

    public invokeCargoClippyUsingClippyArgs(): void {
        const argsBuilder = new CargoTaskArgs('clippy');
        argsBuilder.setMessageFormatToJson();
        argsBuilder.addArgs(UserDefinedArgs.getClippyArgs());

        const args = argsBuilder.getArgs();

        this.runCargo(args, true);
    }

    public invokeCargoNew(projectName: string, isBin: boolean, cwd: string): void {
        this.currentTask = new CargoTask();

        this.channel.clear();

        const args = ['new', projectName, isBin ? '--bin' : '--lib'];

        {
            const configuration = getConfiguration();

            if (configuration['showOutput']) {
                this.channel.show();
            }
        }

        const onLine = (line: string) => {
            this.channel.append(`${line}\n`);
        };

        const onStart = undefined;

        const onStdoutLine = onLine;

        const onStderrLine = onLine;

        this.currentTask.execute(args, cwd, onStart, onStdoutLine, onStderrLine).then(() => {
            this.currentTask = null;
        });
    }

    public invokeCargoRunWithArgs(additionalArgs: string[]): void {
        const argsBuilder = new CargoTaskArgs('run');
        argsBuilder.setMessageFormatToJson();
        argsBuilder.addArgs(additionalArgs);

        const args = argsBuilder.getArgs();

        this.runCargo(args, true);
    }

    public invokeCargoRunUsingRunArgs(): void {
        this.invokeCargoRunWithArgs(UserDefinedArgs.getRunArgs());
    }

    public invokeCargoTestWithArgs(additionalArgs: string[]): void {
        const argsBuilder = new CargoTaskArgs('test');
        argsBuilder.setMessageFormatToJson();
        argsBuilder.addArgs(additionalArgs);

        const args = argsBuilder.getArgs();

        this.runCargo(args, true);
    }

    public invokeCargoTestUsingTestArgs(): void {
        this.invokeCargoTestWithArgs(UserDefinedArgs.getTestArgs());
    }

    public invokeCargoWithArgs(args: string[]): void {
        this.runCargo(args, true);
    }

    public stopTask(): void {
        if (this.currentTask) {
            this.currentTask.kill();
        }
    }

    private updateDiagnostics(cwd: string, errors: RustError[]): void {
        const mapSeverityToVsCode = (severity) => {
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

        const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

        errors.forEach(error => {
            const filePath = path.join(cwd, error.filename);
            // VSCode starts its lines and columns at 0, so subtract 1 off
            const range = new vscode.Range(error.startLine - 1, error.startCharacter - 1, error.endLine - 1, error.endCharacter - 1);
            const severity = mapSeverityToVsCode(error.severity);

            const diagnostic = new vscode.Diagnostic(range, error.message, severity);
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

    private getUniqueDiagnostics(diagnostics: vscode.Diagnostic[]): vscode.Diagnostic[] {
        const uniqueDiagnostics: vscode.Diagnostic[] = [];

        for (const diagnostic of diagnostics) {
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

    private checkCargoCheckAvailability(): Thenable<boolean> {
        const args = ['check', '--help'];
        const cwd = '/'; // Doesn't matter.

        return (new CargoTask).execute(args, cwd).then((exitCode: ExitCode) => {
            return exitCode === 0;
        });
    }

    public parseJsonLine(errors: RustError[], line: string): boolean {
        const errorJson: CargoMessageWithCompilerArtifact | CargoMessageWithCompilerMessage = JSON.parse(line);

        if (errorJson.reason !== 'compiler-message') {
            return false;
        }

        return this.parseCargoMessage(errors, errorJson);
    }

    private parseCargoMessage(errors: RustError[], cargoMessage: CargoMessageWithCompilerMessage): boolean {
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

        const error: RustError = {
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


        error.message = this.addNotesToMessage(error.message, compilerMessage.children, 1);
        errors.push(error);

        return true;
    }

    private showSpinner(): void {
        if (this.statusBarItem == null) {
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            this.statusBarItem.text = spinner();
            this.statusBarItem.tooltip = 'Running Cargo Task';
        }

        this.statusBarItem.show();

        if (this.spinnerUpdate == null) {
            const callback = () => {
                this.statusBarItem.text = spinner();
            };

            this.spinnerUpdate = setInterval(callback, 50);
        }
    }

    private hideSpinner(): void {
        if (this.spinnerUpdate != null) {
            clearInterval(this.spinnerUpdate);

            this.spinnerUpdate = null;
        }

        if (this.statusBarItem != null) {
            this.statusBarItem.hide();
        }
    }

    private runCargo(args: string[], force = false): void {
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
            const configuration = getConfiguration();

            if (configuration['showOutput']) {
                this.channel.show();
            }
        }

        PathService.cwd().then((value: string | Error) => {
            if (typeof value === 'string') {
                this.showSpinner();

                const cwd = value;

                let startTime: number;

                const onStart = () => {
                    startTime = Date.now();

                    this.channel.clear();
                    this.channel.append(`Started cargo ${args.join(' ')}\n`);
                };

                const errors: RustError[] = [];

                const onStdoutLine = (line: string) => {
                    if (line.startsWith('{')) {
                        const newErrors: RustError[] = [];

                        if (this.parseJsonLine(newErrors, line)) {
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

                            errors.push(...newErrors);
                            this.updateDiagnostics(cwd, errors);
                        }
                    } else {
                        this.channel.append(`${line}\n`);
                    }
                };

                const onStderrLine = (line: string) => {
                    this.channel.append(`${line}\n`);
                };

                const onGracefullyEnded = (exitCode: ExitCode) => {
                    this.hideSpinner();

                    this.currentTask = null;

                    const endTime = Date.now();

                    this.channel.append(`Completed with code ${exitCode}\n`);
                    this.channel.append(`It took approximately ${(endTime - startTime) / 1000} seconds\n`);
                };

                const onUnexpectedlyEnded = (error?: Error) => {
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

    private addNotesToMessage(msg: string, children: any[], level: number): string {
        const ident = '   '.repeat(level);

        for (const child of children) {
            msg += `\n${ident}${child.message}`;

            if (child.spans && child.spans.length > 0) {
                msg += ': ';
                const lines = [];

                for (const span of child.spans) {
                    if (!span.file_name || !span.line_start) {
                        continue;
                    }

                    lines.push(`${span.file_name}(${span.line_start})`);
                }

                msg += lines.join(', ');
            }

            if (child.children) {
                msg = this.addNotesToMessage(msg, child.children, level + 1);
            }
        }

        return msg;
    }
}

interface CustomConfiguration {
    title: string;
    args: string[];
}

class CustomConfigurationQuickPickItem implements vscode.QuickPickItem {
    public label: string;
    public description: string;
    public args: string[];

    public constructor(configuration: CustomConfiguration) {
        this.label = configuration.title;
        this.description = '';
        this.args = configuration.args;
    }
}

class CustomConfigurationManager {
    public static showQuickPickOrChooseSingleCustomConfigurationArgsForCargoBuild(): Thenable<string[] | null> {
        return CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgs('customBuildConfigurations');
    }

    public static showQuickPickOrChooseSingleCustomConfigurationArgsForCargoCheck(): Thenable<string[] | null> {
        return CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgs('customCheckConfigurations');
    }

    public static showQuickPickOrChooseSingleCustomConfigurationArgsForCargoRun(): Thenable<string[] | null> {
        return CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgs('customRunConfigurations');
    }

    public static showQuickPickOrChooseSingleCustomConfigurationArgsForCargoTest(): Thenable<string[] | null> {
        return CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgs('customTestConfigurations');
    }

    private static showQuickPickOrChooseSingleCustomConfigurationArgs(property: string): Thenable<string[] | null> {
        const configuration = getConfiguration();

        const customConfigurations = configuration.get<CustomConfiguration[]>(property);

        if (customConfigurations.length === 0) {
            return Promise.resolve(null);
        }

        if (customConfigurations.length === 1) {
            const customConfiguration = customConfigurations[0];

            const args = customConfiguration.args;

            return Promise.resolve(args);
        }

        const quickPickItems = customConfigurations.map(c => new CustomConfigurationQuickPickItem(c));

        return vscode.window.showQuickPick(quickPickItems).then(item => item.args);
    }
}

export class CommandService {
    private cargoManager: CargoManager;

    public constructor() {
        this.cargoManager = new CargoManager();
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoCheck(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgsForCargoCheck().then(args => {
                if (!args) {
                    return;
                }

                this.cargoManager.invokeCargoCheckWithArgs(args);
            });
        });
    }

    public registerCommandInvokingCargoCheckUsingCheckArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.invokeCargoCheckUsingCheckArgs();
        });
    }

    public registerCommandInvokingCargoClippyUsingClippyArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.invokeCargoClippyUsingClippyArgs();
        });
    }

    public registerCommandHelpingCreateProject(commandName: string, isBin: boolean): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            const cwd = vscode.workspace.rootPath;

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

                this.cargoManager.invokeCargoNew(name, isBin, cwd);
            });
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoBuild(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgsForCargoBuild().then(args => {
                if (!args) {
                    return;
                }

                this.cargoManager.invokeCargoBuildWithArgs(args);
            });
        });
    }

    public registerCommandInvokingCargoBuildUsingBuildArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.invokeCargoBuildUsingBuildArgs();
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoRun(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgsForCargoRun().then(args => {
                if (!args) {
                    return;
                }

                this.cargoManager.invokeCargoRunWithArgs(args);
            });
        });
    }

    public registerCommandInvokingCargoRunUsingRunArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.invokeCargoRunUsingRunArgs();
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoTest(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            CustomConfigurationManager.showQuickPickOrChooseSingleCustomConfigurationArgsForCargoTest().then(args => {
                if (!args) {
                    return;
                }

                this.cargoManager.invokeCargoTestWithArgs(args);
            });
        });
    }

    public registerCommandInvokingCargoTestUsingTestArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.invokeCargoTestUsingTestArgs();
        });
    }

    public registerCommandInvokingCargoWithArgs(commandName: string, ...args: string[]): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.invokeCargoWithArgs(args);
        });
    }

    public registerCommandStoppingCargoTask(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.stopTask();
        });
    }
}

function getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('rust');
}
