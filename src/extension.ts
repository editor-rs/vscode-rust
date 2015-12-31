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

    // Initialize suggestion service
    let suggestService = new SuggestService().start();
    ctx.subscriptions.push(suggestService);

    // Initialize format service
    ctx.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(FilterService.getRustModeFilter(), new FormatService()));

    // Initialize status bar service
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(StatusBarService.toggleStatus.bind(StatusBarService)));

    // EXPERIMENTAL: formatting on save
    let rustConfig = vscode.workspace.getConfiguration('rust');
    ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => {
        if (!rustConfig['formatOnSave']) {
            return;
        }
        vscode.commands.executeCommand('editor.action.format');
    }));
    
    // EXPERIMENTAL: cargo check on save
    ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => {
        if (!rustConfig['checkOnSave']) {
            return;
        }
        vscode.commands.executeCommand('rust.cargo.check');
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
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.test', 'test'));
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

    // Cargo terminate
    ctx.subscriptions.push(CommandService.stopCommand('rust.cargo.terminate'));
}
