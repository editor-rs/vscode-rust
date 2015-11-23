import * as vscode from 'vscode';

import FormatService from './services/formatService';
import FilterService from './services/filterService';
import StatusBarService from './services/statusBarService';
import SuggestService from './services/suggestService';
import PathService from './services/pathService';
import CommandService from './services/commandService';

export function activate(ctx: vscode.ExtensionContext): void {
	// Set path to Rust language sources
	let rustSrcPath = PathService.getRustLangSrcPath();
	if (rustSrcPath) {
		process.env['RUST_SRC_PATH'] = rustSrcPath;
	}

	// Utils
	let diagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
	ctx.subscriptions.push(diagnosticCollection);

	// Initialize suggestion service
	let suggestService = new SuggestService().start();
	ctx.subscriptions.push(suggestService);

	// Initialize format service
	ctx.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(FilterService.getRustModeFilter(), new FormatService()));

	// Initialize status bar service
	ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(StatusBarService.toggleStatus));

	// EXPERIMENTAL: formatting on save
	let rustConfig = vscode.workspace.getConfiguration('rust');
	ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
		if (!rustConfig['formatOnSave']) return;
		vscode.commands.executeCommand("editor.action.format");
	}));

	// Watch for configuration changes for ENV
	ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
		let rustLangPath = PathService.getRustLangSrcPath();
		if (process.env['RUST_SRC_PATH'] !== rustLangPath) {
			process.env['RUST_SRC_PATH'] = rustLangPath;
		}
		console.log(process.env);
	}));
	
	// Commands
	// Cargo build
	// ctx.subscriptions.push(CommandService.getCargoBuildHandler(diagnosticCollection));
	// // Cargo test
	// ctx.subscriptions.push(CommandService.getCargoTestHandler());
	// // Cargo run
	// ctx.subscriptions.push(CommandService.getCargoRunHandler());
}
