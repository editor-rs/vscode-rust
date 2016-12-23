import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import FormatService from './services/formatService';
import FilterService from './services/filterService';
import StatusBarService from './services/statusBarService';
import SuggestService from './services/suggestService';
import PathService from './services/pathService';
import {BuildType, CheckTarget, CommandService} from './services/commandService';
import WorkspaceSymbolService from './services/workspaceSymbolService';
import DocumentSymbolService from './services/documentSymbolService';
import {Installator as MissingToolsInstallator} from './installTools';

function initializeSuggestService(ctx: vscode.ExtensionContext): void {
    // Initialize suggestion service
    let suggestService = new SuggestService();

    // Set path to Rust language sources
    let rustSrcPath = PathService.getRustLangSrcPath();
    if (rustSrcPath) {
        process.env['RUST_SRC_PATH'] = rustSrcPath;

        ctx.subscriptions.push(suggestService.start());
    } else {
        PathService.getRustcSysroot().then(sysroot => {
            rustSrcPath = path.join(sysroot, 'lib', 'rustlib', 'src', 'rust', 'src');
            fs.access(rustSrcPath, err => {
                if (!err) {
                    process.env['RUST_SRC_PATH'] = rustSrcPath;
                } else if (rustSrcPath.includes('.rustup')) {
                    // tslint:disable-next-line
                    const message = 'You are using rustup, but don\'t have installed source code. Do you want to install it?';
                    vscode.window.showErrorMessage(message, 'Yes').then(chosenItem => {
                        if (chosenItem === 'Yes') {
                            const terminal = vscode.window.createTerminal('Rust source code installation');
                            terminal.sendText('rustup component add rust-src');
                            terminal.show();
                        }
                    });
                }
                ctx.subscriptions.push(suggestService.start());
            });
        });
    }

    // Racer crash error
    ctx.subscriptions.push(suggestService.racerCrashErrorCommand('rust.racer.showerror'));
}

export function activate(ctx: vscode.ExtensionContext): void {
    initializeSuggestService(ctx);

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
                    case 'check-lib':
                        vscode.commands.executeCommand('rust.cargo.check.lib');
                        break;
                    case 'test':
                        vscode.commands.executeCommand('rust.cargo.test.debug');
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
    }));

    {
        let installator = new MissingToolsInstallator();
        installator.addStatusBarItemIfSomeToolsAreMissing();
    }

    // Commands
    // Cargo new
    ctx.subscriptions.push(CommandService.createProjectCommand('rust.cargo.new.bin', true));
    ctx.subscriptions.push(CommandService.createProjectCommand('rust.cargo.new.lib', false));
    // Cargo build
    ctx.subscriptions.push(CommandService.createBuildCommand('rust.cargo.build.debug', BuildType.Debug));
    ctx.subscriptions.push(CommandService.createBuildCommand('rust.cargo.build.release', BuildType.Release));
    ctx.subscriptions.push(CommandService.buildExampleCommand('rust.cargo.build.example.debug', false));
    ctx.subscriptions.push(CommandService.buildExampleCommand('rust.cargo.build.example.release', true));
    ctx.subscriptions.push(CommandService.runExampleCommand('rust.cargo.run.example.debug', false));
    ctx.subscriptions.push(CommandService.runExampleCommand('rust.cargo.run.example.release', true));
    // Cargo run
    ctx.subscriptions.push(CommandService.createRunCommand('rust.cargo.run.debug', BuildType.Debug));
    ctx.subscriptions.push(CommandService.createRunCommand('rust.cargo.run.release', BuildType.Release));
    // Cargo test
    ctx.subscriptions.push(CommandService.createTestCommand('rust.cargo.test.debug', BuildType.Debug));
    ctx.subscriptions.push(CommandService.createTestCommand('rust.cargo.test.release', BuildType.Release));
    // Cargo bench
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.bench', 'bench'));
    // Cargo doc
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.doc', 'doc'));
    // Cargo update
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.update', 'update'));
    // Cargo clean
    ctx.subscriptions.push(CommandService.formatCommand('rust.cargo.clean', 'clean'));
    // Cargo check
    ctx.subscriptions.push(CommandService.createCheckCommand('rust.cargo.check', CheckTarget.Application));
    // Cargo check lib
    ctx.subscriptions.push(CommandService.createCheckCommand('rust.cargo.check.lib', CheckTarget.Library));
    // Cargo clippy
    ctx.subscriptions.push(CommandService.createClippyCommand('rust.cargo.clippy'));

    // Cargo terminate
    ctx.subscriptions.push(CommandService.stopCommand('rust.cargo.terminate'));
}
