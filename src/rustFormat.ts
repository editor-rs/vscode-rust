import vscode = require('vscode');
import cp = require('child_process');

import { getRustfmtPath } from './rustPath';

function formatRustfmtCommand(fileName: string, writeMode: string): string {
	return getRustfmtPath() + ' --write-mode=' + writeMode + ' ' + fileName;
}

export class RustDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
	private writeMode: string = 'display';
	
	public provideDocumentFormattingEdits(document: vscode.TextDocument, 
										  options: vscode.FormattingOptions, 
										  token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
		return document.save().then(() => {
			return this.performFormatFile(document, options, token);
		});
	}
	
	private performFormatFile(document: vscode.TextDocument, 
							  options: vscode.FormattingOptions, 
							  token: vscode.CancellationToken) : Promise<vscode.TextEdit[]> {
		return new Promise(function (resolve, reject) {
			let fileName = document.fileName;
			
			let command = formatRustfmtCommand(fileName, this.writeMode);
			
			cp.exec(command, (err, stdout, stderr) => {
				try {
					if (err && (<any>err).code == 'ENOENT') {
						vscode.window.showInformationMessage('The "rustfmt" command is not available.');
						return resolve(null);
					}
					if (err) return reject('Cannot format due to syntax errors');
					
					let text = stdout.toString();
					
					//TODO: implement parsing of rustfmt output with 'diff' writemode
					let lastLine = document.lineCount;
					let lastLineLastCol = document.lineAt(lastLine - 1).range.end.character;
					let range = new vscode.Range(0, 0, lastLine - 1, lastLineLastCol);
					return resolve([new vscode.TextEdit(range, text)]);
				} catch(e) {
					reject(e);
				}
			});
		});
	}
}