import * as vscode from 'vscode';

import FormatService from './services/formatService';
import FilterService from './services/filterService';
import StatusBarService from './services/statusBarService';
import SuggestService from './services/suggestService';
import PathService from './services/pathService';
import CommandService from './services/commandService';
import WorkspaceSymbolService from './services/workspaceSymbolService';
import DocumentSymbolService from './services/documentSymbolService';

export function activate(ctx: vscode.ExtensionContext): void {
    // Set path to Rust language sources
    let rustSrcPath = PathService.getRustLangSrcPath();
    if (rustSrcPath) {
        process.env['RUST_SRC_PATH'] = rustSrcPath;
    }

    // Initialize suggestion service
    let suggestService = new SuggestService();
    ctx.subscriptions.push(suggestService.start());

    // Initialize format service
    let formatService = new FormatService();
    ctx.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(FilterService.getRustModeFilter(), formatService));

    // Initialize symbol provider services
    ctx.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolService()));
    ctx.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(FilterService.getRustModeFilter(), new DocumentSymbolService()));

    // Initialize status bar service
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(StatusBarService.toggleStatus.bind(StatusBarService)));

    let alreadyAppliedFormatting = new WeakSet<vscode.TextDocument>();

    ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId !== 'rust' || !document.fileName.endsWith('.rs') || alreadyAppliedFormatting.has(document)) {
            return;
        }

        let rustConfig = vscode.workspace.getConfiguration('rust');
        let textEditor = vscode.window.activeTextEditor;

        let formatPromise: PromiseLike<void> = Promise.resolve();

        // Incredibly ugly hack to work around no presave event
        // based on https://github.com/Microsoft/vscode-go/pull/115/files
        if (rustConfig['formatOnSave'] && textEditor.document === document) {
            formatPromise = formatService.provideDocumentFormattingEdits(document).then(edits => {
                return textEditor.edit(editBuilder => {
                    edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
                });
            }).then(() => {
                alreadyAppliedFormatting.add(document);
                return document.save();
            }).then(() => {
                alreadyAppliedFormatting.delete(document);
            }, () => {
				// Catch any errors and ignore so that we still trigger 
				// the file save.
            });
        }

        if (rustConfig['checkOnSave']) {
            formatPromise.then(() => {
                switch (rustConfig['checkWith']) {
                    case 'clippy':
                        vscode.commands.executeCommand('rust.cargo.clippy');
                        break;
                    case 'build':
                        vscode.commands.executeCommand('rust.cargo.build.debug');
                        break;
                    default:
                        vscode.commands.executeCommand('rust.cargo.check');
                }
            });
        }
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
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.build.debug', 'build'));
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.build.release', 'build', '--release'));
    ctx.subscriptions.push(CommandService.buildExampleCommand('rust.cargo.build.example.debug', false));
    ctx.subscriptions.push(CommandService.buildExampleCommand('rust.cargo.build.example.release', true));
    ctx.subscriptions.push(CommandService.runExampleCommand('rust.cargo.run.example.debug', false));
    ctx.subscriptions.push(CommandService.runExampleCommand('rust.cargo.run.example.release', true));
    // Cargo run
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.run.debug', 'run'));
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.run.release', 'run', '--release'));
    // Cargo test
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.test.debug', 'test'));
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.test.release', 'test', '--release'));
    // Cargo bench
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.bench', 'bench'));
    // Cargo doc
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.doc', 'doc'));
    // Cargo update
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.update', 'update'));
    // Cargo clean
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.clean', 'clean'));
    // Cargo check
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.check', 'rustc', '--', '-Zno-trans'));
    // Cargo clippy
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.clippy', 'clippy'));
    // Racer crash error
    ctx.subscriptions.push(suggestService.racerCrashErrorCommand('rust.racer.showerror'));

    // Cargo terminate
    ctx.subscriptions.push(CommandService.stopCommand('rust.cargo.terminate'));
}
