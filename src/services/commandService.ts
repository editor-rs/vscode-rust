import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

const channelTabSize = 2;
const channelTabName = 'Cargo';

export default class CommandService {
	public static formatCommand(commandName: string, subCommand: string, args?: string): vscode.Disposable {
		return vscode.commands.registerCommand(commandName, () => {
			this.runCargo(subCommand, args);	
		});
	}
	
	private static runCargo(command: string, args?: string): void {
		let channel = vscode.window.createOutputChannel(channelTabName);
		let cwd = vscode.workspace.rootPath;
		args = args || '';
		
		channel.clear();
		channel.show(channelTabSize);
		channel.appendLine(this.formTitle(command, args));
		
		let params: string[] = [command];
		if (args.length > 0) {
			params.push(args);
		}
		
		let startTime = new Date().getMilliseconds();
		let cargoProc = cp.spawn('cargo', params, { cwd, env: process.env });
		cargoProc.stdout.on('data', data => {
			channel.append(data.toString());
		});
		cargoProc.stderr.on('data', data => {
			channel.append(data.toString());
		});
		cargoProc.on('exit', code => {
			cargoProc.removeAllListeners();
			let endTime = new Date().getMilliseconds();
			channel.append(`\n"cargo ${command} ${args}" completed with code ${code}`);
			channel.append(`\nIt took approximately ${(endTime - startTime) / 1000} seconds`);
		});
	}
	
	private static formTitle(command: string, args: string): string {
		if (args.length > 0) return `Running "cargo ${command} ${args}":\n`;
		return `Running "cargo ${command}":\n`
	}
}