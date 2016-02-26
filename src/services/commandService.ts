import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import kill = require('tree-kill');

import PathService from './pathService';

const errorRegex = /^(.*):(\d+):(\d+):\s+(\d+):(\d+)\s+(warning|error):\s+(.*)$/;

interface RustError {
    filename: string;
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
    severity: string;
    message: string;
}

class ChannelWrapper {
    private owner: CargoTask;
    private channel: vscode.OutputChannel;

    constructor(channel: vscode.OutputChannel) {
        this.channel = channel;
    }

    public append(task: CargoTask, message: string): void {
        if (task === this.owner) {
            this.channel.append(message);
        }
    }

    public clear(task: CargoTask): void {
        if (task === this.owner) {
            this.channel.clear();
        }
    }

    public show(): void {
        this.channel.show(2);
    }

    public setOwner(owner: CargoTask): void {
        this.owner = owner;
    }
}

class CargoTask {
    private channel: ChannelWrapper;
    private process: cp.ChildProcess;
    private arguments: string[];
    private interrupted: boolean;

    constructor(args: string[], channel: ChannelWrapper) {
        this.arguments = args;
        this.channel = channel;
        this.interrupted = false;
    }

    public execute(cwd: string): Thenable<string> {
        return new Promise((resolve, reject) => {
            const cargoPath = PathService.getCargoPath();
            const startTime = Date.now();
            const task = 'cargo ' + this.arguments.join(' ');
            let output = '';

            this.channel.clear(this);
            this.channel.append(this, `Running "${task}":\n`);

            this.process = cp.spawn(cargoPath, this.arguments, { cwd });

            this.process.stdout.on('data', data => {
                this.channel.append(this, data.toString());
            });
            this.process.stderr.on('data', data => {
                output += data.toString();
                this.channel.append(this, data.toString());
            });
            this.process.on('error', error => {
                if (error.code === 'ENOENT') {
                    vscode.window.showInformationMessage('The "cargo" command is not available. Make sure it is installed.');
                }
            });
            this.process.on('exit', code => {
                this.process.removeAllListeners();
                this.process = null;
                const endTime = Date.now();
                this.channel.append(this, `\n"${task}" completed with code ${code}`);
                this.channel.append(this, `\nIt took approximately ${(endTime - startTime) / 1000} seconds`);

                if (code === 0 || this.interrupted) {
                    resolve(this.interrupted ? '' : output);
                } else {
                    if (code !== 101) {
                        vscode.window.showWarningMessage(`Cargo unexpectedly stopped with code ${code}`);
                    }
                    reject(output);
                }
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

export default class CommandService {
    private static diagnostics: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
    private static channel: ChannelWrapper = new ChannelWrapper(vscode.window.createOutputChannel('Cargo'));
    private static currentTask: CargoTask;

    public static formatCommand(commandName: string, ...args: string[]): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.runCargo(args, true, true);
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

    private static buildExample(release: boolean): void {
        let exampleName = this.determineExampleName();
        if (exampleName.length === 0) {
            return;
        }
        let args = ['build', '--example', exampleName];
        if (release) {
            args.push('--release');
        }
        this.runCargo(args, true, true);
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
        this.runCargo(args, true, true);
    }

    private static parseDiagnostics(cwd: string, output: string): void {
        let errors: { [filename: string]: RustError[] } = {};

        for (let line of output.split('\n')) {
            let match = line.match(errorRegex);
            if (match) {
                let filename = match[1];
                if (!errors[filename]) {
                    errors[filename] = [];
                }

                errors[filename].push({
                    filename: filename,
                    startLine: Number(match[2]) - 1,
                    startCharacter: Number(match[3]) - 1,
                    endLine: Number(match[4]) - 1,
                    endCharacter: Number(match[5]) - 1,
                    severity: match[6],
                    message: match[7]
                });
            }
        }

        this.diagnostics.clear();
        if (!Object.keys(errors).length) {
            return;
        }

        for (let filename of Object.keys(errors)) {
            let fileErrors = errors[filename];
            let diagnostics = fileErrors.map((error) => {
                let range = new vscode.Range(error.startLine, error.startCharacter, error.endLine, error.endCharacter);
                let severity: vscode.DiagnosticSeverity;

                if (error.severity === 'warning') {
                    severity = vscode.DiagnosticSeverity.Warning;
                } else if (error.severity === 'error') {
                    severity = vscode.DiagnosticSeverity.Error;
                }

                return new vscode.Diagnostic(range, error.message, severity);
            });

            let uri = vscode.Uri.file(path.join(cwd, filename));
            this.diagnostics.set(uri, diagnostics);
        }
    }

    private static runCargo(args: string[], force = false, visible = false): void {
        if (force && this.currentTask) {
            this.channel.setOwner(null);
            this.currentTask.kill().then(() => {
                this.runCargo(args, force, visible);
            });
            return;
        } else if (this.currentTask) {
            return;
        }

        this.currentTask = new CargoTask(args, this.channel);

        if (visible) {
            this.channel.setOwner(this.currentTask);
            this.channel.show();
        }

        const cwd = CommandService.cwd();
        this.currentTask.execute(cwd).then(output => {
            this.parseDiagnostics(cwd, output);
        }, output => {
            this.parseDiagnostics(cwd, output);
        }).then(() => {
            this.currentTask = null;
        });
    }

    private static cwd(): string {
        if (vscode.window.activeTextEditor === null) {
            return vscode.workspace.rootPath;
        } else {
            const srcPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
            return path.dirname(srcPath);
        }
    }
}
