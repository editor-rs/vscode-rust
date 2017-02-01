import {
    ExtensionContext,
    SymbolInformation,
    WorkspaceSymbolProvider,
    languages,
    window
} from 'vscode';

import ConfigurationManager from '../configuration/configuration_manager';

import CurrentWorkingDirectoryManager from '../configuration/current_working_directory_manager';

import SymbolSearchManager from './symbol_search_manager';

export default class WorkspaceSymbolProvisionManager implements WorkspaceSymbolProvider {
    private configurationManager: ConfigurationManager;

    private currentWorkingDirectoryManager: CurrentWorkingDirectoryManager;

    private symbolSearchManager: SymbolSearchManager;

    public constructor(
        context: ExtensionContext,
        configurationManager: ConfigurationManager,
        currentWorkingDirectoryManager: CurrentWorkingDirectoryManager
    ) {
        this.configurationManager = configurationManager;

        this.currentWorkingDirectoryManager = currentWorkingDirectoryManager;

        this.symbolSearchManager = new SymbolSearchManager(configurationManager);

        context.subscriptions.push(languages.registerWorkspaceSymbolProvider(this));
    }

    public provideWorkspaceSymbols(query: string): Thenable<SymbolInformation[]> {
        return new Promise<SymbolInformation[]>((resolve, reject) => {
            const cwdPromise = this.currentWorkingDirectoryManager.cwd();
            cwdPromise.then((workspaceDirPath: string) => {
                const symbolInformationListPromise =
                    this.symbolSearchManager.findSymbolsInWorkspace(workspaceDirPath, query);
                symbolInformationListPromise.then((symbolInformationList) => {
                    resolve(symbolInformationList);
                });
            }).catch((error: Error) => {
                window.showErrorMessage(error.message);

                reject(error.message);
            });
        });
    }
}
