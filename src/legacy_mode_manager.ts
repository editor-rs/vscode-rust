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
    }

    public start(): void {
        this.context.subscriptions.push(this.completionManager.disposable());
        this.completionManager.initialStart();
    }
}
