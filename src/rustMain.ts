import vscode = require('vscode');

import { RustCompletionItemProvider } from './rustSuggest';
import { RustDocumentFormattingEditProvider } from './rustFormat';
import { RUST_MODE } from './rustMode';
import { showHideStatus } from './rustStatus'; 

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(ctx: vscode.ExtensionContext): void {
	console.log('RustyCode activated');
	
	let rustConfig = vscode.workspace.getConfiguration('rust');
	diagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
	
	ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(RUST_MODE, new RustCompletionItemProvider()));
	ctx.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(RUST_MODE, new RustDocumentFormattingEditProvider()));
	
	ctx.subscriptions.push(diagnosticCollection);
	ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(showHideStatus));
	
	ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
		if (!rustConfig['formatOnSave']) return;
		vscode.commands.executeCommand("editor.action.format");
	}));
}