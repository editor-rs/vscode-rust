import * as vscode from 'vscode';
import * as cp from 'child_process';

interface CargoOutput {
	
}
export default class CommandService {
	public static getCargoBuildHandler(diagnosticCollection: vscode.DiagnosticCollection): vscode.Disposable {
		return vscode.commands.registerCommand('rust.cargo.build', () => {
			diagnosticCollection.clear();
			CommandService.runCargoWith('build').then(() => {
				vscode.window.showInformationMessage('Cargo Build Done');
			});
		})
	}
	
	public static getCargoTestHandler(): vscode.Disposable {
		return vscode.commands.registerCommand('rust.cargo.test', () => {
			vscode.window.showInformationMessage('Cargo Test');
		});
	}
	
	public static getCargoRunHandler(): vscode.Disposable {
		return vscode.commands.registerCommand('rust.cargo.run', () => {
			vscode.window.showInformationMessage('Cargo Run');
		});
	}
	
	private static runCargoWith(subcommand: string): Thenable<CargoOutput[]> {
		return new Promise((resolve, reject) => {
			cp.exec('cargo build', {}, (error, stdout, stderr) => {
				try {
					if (error && (<any>error).code == "ENOENT") {
						vscode.window.showInformationMessage("The 'cargo' command is not available.");
						return resolve([]);
					}
					console.log(stdout);
					console.error(error);
					if (error) return reject(error);
				} catch(e) {
					reject(e);
				}
			})
		});
	}
}