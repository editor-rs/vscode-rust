import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import FormatService from './services/formatService';
import FilterService from './services/filterService';
import StatusBarService from './services/statusBarService';
import SuggestService from './services/suggestService';
import PathService from './services/pathService';
import {CommandService} from './services/commandService';
import {ChildLogger} from './logging/mod';
import WorkspaceSymbolService from './services/workspaceSymbolService';
import DocumentSymbolService from './services/documentSymbolService';
import LoggingManager from './services/logging_manager';
import {Installator as MissingToolsInstallator} from './installTools';

function initializeSuggestService(ctx: vscode.ExtensionContext, logger: ChildLogger): void {
    // Initialize suggestion service
    let suggestService = new SuggestService(logger);

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
    const loggingManager = new LoggingManager();

    const logger = loggingManager.getLogger();

    initializeSuggestService(ctx, logger.createChildLogger('SuggestService: '));

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

        const actionOnSave: string | null = rustConfig['actionOnSave'];

        if (actionOnSave === null) {
            return;
        }

        let command: string;

        switch (actionOnSave) {
            case 'build':
                command = 'rust.cargo.build.default';
            break;
            case 'check':
                command = 'rust.cargo.check.default';
            break;
            case 'clippy':
                command = 'rust.cargo.clippy.default';
            break;
            case 'run':
                command = 'rust.cargo.run.default';
            break;
            case 'test':
                command = 'rust.cargo.test.default';
            break;
        }

        formatPromise.then(() => {
            vscode.commands.executeCommand(command);
        });
    }));

    // Watch for configuration changes for ENV
    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        let rustLangPath = PathService.getRustLangSrcPath();
        if (process.env['RUST_SRC_PATH'] !== rustLangPath) {
            process.env['RUST_SRC_PATH'] = rustLangPath;
        }
    }));

    {
        let installator = new MissingToolsInstallator(logger.createChildLogger('MissingToolsInstallator: '));
        installator.addStatusBarItemIfSomeToolsAreMissing();
    }

    // Commands
    const commandService = new CommandService(logger.createChildLogger('CommandService: '));

    // Cargo init
    ctx.subscriptions.push(commandService.registerCommandHelpingCreatePlayground('rust.cargo.new.playground'));

    // Cargo new
    ctx.subscriptions.push(commandService.registerCommandHelpingCreateProject('rust.cargo.new.bin', true));

    ctx.subscriptions.push(commandService.registerCommandHelpingCreateProject('rust.cargo.new.lib', false));

    // Cargo build
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoBuildUsingBuildArgs('rust.cargo.build.default'));

    ctx.subscriptions.push(commandService.registerCommandHelpingChooseArgsAndInvokingCargoBuild('rust.cargo.build.custom'));

    // Cargo run
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoRunUsingRunArgs('rust.cargo.run.default'));

    ctx.subscriptions.push(commandService.registerCommandHelpingChooseArgsAndInvokingCargoRun('rust.cargo.run.custom'));

    // Cargo test
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoTestUsingTestArgs('rust.cargo.test.default'));

    ctx.subscriptions.push(commandService.registerCommandHelpingChooseArgsAndInvokingCargoTest('rust.cargo.test.custom'));

    // Cargo bench
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoWithArgs('rust.cargo.bench', 'bench'));

    // Cargo doc
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoWithArgs('rust.cargo.doc', 'doc'));

    // Cargo update
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoWithArgs('rust.cargo.update', 'update'));

    // Cargo clean
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoWithArgs('rust.cargo.clean', 'clean'));

    // Cargo check
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoCheckUsingCheckArgs('rust.cargo.check.default'));

    ctx.subscriptions.push(commandService.registerCommandHelpingChooseArgsAndInvokingCargoCheck('rust.cargo.check.custom'));

    // Cargo clippy
    ctx.subscriptions.push(commandService.registerCommandInvokingCargoClippyUsingClippyArgs('rust.cargo.clippy.default'));

    ctx.subscriptions.push(commandService.registerCommandHelpingChooseArgsAndInvokingCargoClippy('rust.cargo.clippy.custom'));

    // Cargo terminate
    ctx.subscriptions.push(commandService.registerCommandStoppingCargoTask('rust.cargo.terminate'));
}
