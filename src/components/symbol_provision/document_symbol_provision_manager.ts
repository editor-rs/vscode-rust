import {
    DocumentSymbolProvider,
    ExtensionContext,
    SymbolInformation,
    TextDocument,
    languages
} from 'vscode';

import ConfigurationManager from '../configuration/configuration_manager';

import getDocumentFilter from '../configuration/mod';

import SymbolSearchManager from './symbol_search_manager';

export default class DocumentSymbolProvisionManager implements DocumentSymbolProvider {
    private symbolSearchManager: SymbolSearchManager;

    public constructor(context: ExtensionContext, configurationManager: ConfigurationManager) {
        this.symbolSearchManager = new SymbolSearchManager(configurationManager);

        context.subscriptions.push(
            languages.registerDocumentSymbolProvider(getDocumentFilter(), this)
        );
    }

    public provideDocumentSymbols(document: TextDocument): Thenable<SymbolInformation[]> {
        return this.symbolSearchManager.findSymbolsInDocument(document.fileName);
    }
}
