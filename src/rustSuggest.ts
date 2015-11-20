'use strict';

import vscode = require('vscode');
import cp = require('child_process');

import { getRustLangSrcPath, getRacerPath } from './rustPath';

// TODO: Export this as separate service later
const RUST_SRC_PATH = '/Users/sid/Desktop/code/rust/rust-lang/src/';

function vsCodeKindFromRacerType(racerType: string): vscode.CompletionItemKind {
	switch (racerType) {
		case 'Function':
			return vscode.CompletionItemKind.Function;
		case 'Struct':
			return vscode.CompletionItemKind.Class;
		case 'Module':
			return vscode.CompletionItemKind.Module;
		case 'Type':
			return vscode.CompletionItemKind.Unit;
		case 'Trait':
			return vscode.CompletionItemKind.Interface;
		case 'Enum':
			return vscode.CompletionItemKind.Enum;
		case 'EnumVariant':
			return vscode.CompletionItemKind.Field;
		case 'Const':
			return vscode.CompletionItemKind.Variable;
	}
	return vscode.CompletionItemKind.Property;
}

function parseRacerResult(racerOutput: string): vscode.CompletionItem[] {
	var lines = racerOutput.replace('END', '').split('MATCH').map(line => { return line.trim() }).slice(1);

	if (lines.length <= 0) return [];
	
	var suggestions = lines.map(line => {
		var lineItems = line.trim().split(';');
		
		var suggestion = new vscode.CompletionItem(lineItems[0]);
		suggestion.kind = vsCodeKindFromRacerType(lineItems[5]);
		suggestion.insertText = lineItems[1];
		suggestion.detail = lineItems[6];
		return suggestion;
	});
	
	return suggestions;
}

function formatRacerCommand(args: Array<string>): string {
	let setEnv;
	if (process.platform === 'win32')
		setEnv = 'SET RUST_SRC_PATH=' + getRustLangSrcPath() + '&&';
	else
		setEnv = 'RUST_SRC_PATH=' + getRustLangSrcPath();
		
	return setEnv + ' ' + getRacerPath() + ' ' + args.join(' ');
}

export class RustCompletionItemProvider implements vscode.CompletionItemProvider {
	public provideCompletionItems(document: vscode.TextDocument, 
								  position: vscode.Position, 
								  token: vscode.CancellationToken): Promise<vscode.CompletionItem[]> {
		return new Promise(function(resolve, reject) {
			var fileName = document.fileName;
			
			// Line number in vsCode is zero-based and in racer not
			var lineNumber = (position.line + 1).toString();
			var characterNumber = position.character.toString();
			
			var args = ['complete-with-snippet', lineNumber, characterNumber, fileName];
			var command = formatRacerCommand(args);
			
			var p = cp.exec(command, (err, stdout, stderr) => {
				try {
					if (err && (<any>err).code == 'ENOENT') {
						vscode.window.showInformationMessage('The "racer" command is not available');
					}
					if (err) return reject(err);
					
					var suggestions = parseRacerResult(stdout.toString());
					resolve(suggestions);
				} catch(e) {
					reject(e);
				}
			});
		});
	}
}