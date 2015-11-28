import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

const channelTabSize = 2;
const channelTabName = 'Cargo';
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

export default class CommandService {
	private static diagnostics: vscode.DiagnosticCollection;

	public static formatCommand(commandName: string, ...args: string[]): vscode.Disposable {
		return vscode.commands.registerCommand(commandName, () => {
			this.runCargo(args);
		});
	}

	private static parseDiagnostics(output: string) {
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
			})

			let uri = vscode.Uri.file(path.join(vscode.workspace.rootPath, filename));
			this.diagnostics.set(uri, diagnostics);
		}
	}

	private static runCargo(args: string[]): void {
		if (!this.diagnostics) {
			this.diagnostics = vscode.languages.createDiagnosticCollection('rust');
		}

		let channel = vscode.window.createOutputChannel(channelTabName);
		let cwd = vscode.workspace.rootPath;

		channel.clear();
		channel.show(channelTabSize);
		channel.appendLine(this.formTitle(args));

		let startTime = Date.now();
		let cargoProc = cp.spawn('cargo', args, { cwd, env: process.env });
		let output = '';
		cargoProc.stdout.on('data', data => {
			channel.append(data.toString());
		});
		cargoProc.stderr.on('data', data => {
			output += data.toString();
			channel.append(data.toString());
		});
		cargoProc.on('exit', code => {
			cargoProc.removeAllListeners();
			let endTime = Date.now();
			channel.append(`\n"cargo ${args.join(' ')}" completed with code ${code}`);
			channel.append(`\nIt took approximately ${(endTime - startTime) / 1000} seconds`);
			this.parseDiagnostics(output);
		});
	}

	private static formTitle(args: string[]): string {
		return `Running "cargo ${args.join(' ')}":\n`;
	}
}
