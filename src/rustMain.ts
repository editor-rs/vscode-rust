// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import vscode = require('vscode');

import { RustCompletionItemProvider } from './rustSuggest';
import { RUST_MODE } from './rustMode';
import { showHideStatus } from './rustStatus'; 

let diagnosticCollection: vscode.DiagnosticCollection;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(ctx: vscode.ExtensionContext): void {
	console.log('RustyCode activated');
	ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(RUST_MODE, new RustCompletionItemProvider()));
	
	diagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
	ctx.subscriptions.push(diagnosticCollection);
	ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(showHideStatus));
}