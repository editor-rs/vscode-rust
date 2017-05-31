import {
    DocumentSymbolProvider,
    ExtensionContext,
    SymbolInformation,
    TextDocument,
    languages
} from 'vscode';
import { Configuration } from '../configuration/Configuration';
import { getDocumentFilter } from '../configuration/mod';
import { SymbolSearchManager } from './symbol_search_manager';

export class DocumentSymbolProvisionManager implements DocumentSymbolProvider {
    private symbolSearchManager: SymbolSearchManager;

    public constructor(context: ExtensionContext, configuration: Configuration) {
        this.symbolSearchManager = new SymbolSearchManager(configuration);
        context.subscriptions.push(
            languages.registerDocumentSymbolProvider(getDocumentFilter(), this)
        );
    }

    public provideDocumentSymbols(document: TextDocument): Thenable<SymbolInformation[]> {
        return this.symbolSearchManager.findSymbolsInDocument(document.fileName);
    }
}
