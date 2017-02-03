import { ExtensionContext } from 'vscode';

import { ConfigurationManager } from './components/configuration/configuration_manager';

import CurrentWorkingDirectoryManager
    from './components/configuration/current_working_directory_manager';

import CompletionManager from './components/completion/completion_manager';

import FormattingManager from './components/formatting/formatting_manager';

import ChildLogger from './components/logging/child_logger';

import DocumentSymbolProvisionManager
    from './components/symbol_provision/document_symbol_provision_manager';

import WorkspaceSymbolProvisionManager
    from './components/symbol_provision/workspace_symbol_provision_manager';

import MissingToolsInstallator from './components/tools_installation/installator';

export default class LegacyModeManager {
    private context: ExtensionContext;

    private completionManager: CompletionManager;

    private formattingManager: FormattingManager;

    private workspaceSymbolProvisionManager: WorkspaceSymbolProvisionManager;

    private documentSymbolProvisionManager: DocumentSymbolProvisionManager;

    private missingToolsInstallator: MissingToolsInstallator;

    // private commandService: CommandService;

    public constructor(
        context: ExtensionContext,
        configurationManager: ConfigurationManager,
        currentWorkingDirectoryManager: CurrentWorkingDirectoryManager,
        logger: ChildLogger
    ) {
        this.context = context;

        this.completionManager = new CompletionManager(
            context,
            configurationManager,
            logger.createChildLogger('CompletionManager: ')
        );

        this.formattingManager = new FormattingManager(context, configurationManager);

        this.workspaceSymbolProvisionManager = new WorkspaceSymbolProvisionManager(
            context,
            configurationManager,
            currentWorkingDirectoryManager
        );

        this.documentSymbolProvisionManager = new DocumentSymbolProvisionManager(
            context,
            configurationManager
        );

        this.missingToolsInstallator = new MissingToolsInstallator(
            context,
            configurationManager,
            logger.createChildLogger('MissingToolsInstallator: ')
        );
        this.missingToolsInstallator.addStatusBarItemIfSomeToolsAreMissing();

        // this.commandService =
            // new CommandService(context, logger.createChildLogger('Command Service: '));
    }
}

// function initializeSuggestService(ctx: vscode.ExtensionContext, logger: ChildLogger): void {
//     // Initialize suggestion service
//     let suggestService = new SuggestService(logger);
// }

// export function activate(ctx: vscode.ExtensionContext): void {
//     const loggingManager = new LoggingManager();

//     const logger = loggingManager.getLogger();

//     initializeSuggestService(ctx, logger.createChildLogger('SuggestService: '));

//     let alreadyAppliedFormatting = new WeakSet<vscode.TextDocument>();

//     ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
//         if (document.languageId !== 'rust' || !document.fileName.endsWith('.rs') || alreadyAppliedFormatting.has(document)) {
//             return;
//         }

//         let rustConfig = vscode.workspace.getConfiguration('rust');
//         let textEditor = vscode.window.activeTextEditor;

//         let formatPromise: PromiseLike<void> = Promise.resolve();

//         // Incredibly ugly hack to work around no presave event
//         // based on https://github.com/Microsoft/vscode-go/pull/115/files
//         if (rustConfig['formatOnSave'] && textEditor.document === document) {
//             formatPromise = formatService.provideDocumentFormattingEdits(document).then(edits => {
//                 return textEditor.edit(editBuilder => {
//                     edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
//                 });
//             }).then(() => {
//                 alreadyAppliedFormatting.add(document);
//                 return document.save();
//             }).then(() => {
//                 alreadyAppliedFormatting.delete(document);
//             }, () => {
//                 // Catch any errors and ignore so that we still trigger
//                 // the file save.
//             });
//         }

//         const actionOnSave: string | null = rustConfig['actionOnSave'];

//         if (actionOnSave === null) {
//             return;
//         }

//         let command: string;

//         switch (actionOnSave) {
//             case 'build':
//                 command = 'rust.cargo.build.default';
//                 break;
//             case 'check':
//                 command = 'rust.cargo.check.default';
//                 break;
//             case 'clippy':
//                 command = 'rust.cargo.clippy.default';
//                 break;
//             case 'run':
//                 command = 'rust.cargo.run.default';
//                 break;
//             case 'test':
//                 command = 'rust.cargo.test.default';
//                 break;
//         }

//         formatPromise.then(() => {
//             vscode.commands.executeCommand(command);
//         });
//     }));

//     // Watch for configuration changes for ENV
//     ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
//         let rustLangPath = PathService.getRustLangSrcPath();
//         if (process.env['RUST_SRC_PATH'] !== rustLangPath) {
//             process.env['RUST_SRC_PATH'] = rustLangPath;
//         }
//     }));

//     {
//         let installator = new MissingToolsInstallator(logger.createChildLogger('MissingToolsInstallator: '));
//         installator.addStatusBarItemIfSomeToolsAreMissing();
//     }
// }
