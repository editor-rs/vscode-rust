import { ExtensionContext } from 'vscode';
import { LanguageClientOptions, LanguageClient, ServerOptions } from 'vscode-languageclient';

export default class LanguageClientManager {
    private languageClient: LanguageClient;

    private context: ExtensionContext;

    public constructor(context: ExtensionContext) {
        const env = process.env;
        env.RUST_LOG = 'rls';

        const serverOptions: ServerOptions = {
            command: 'rls',
            options: { env: env }
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: ['rust'],
            synchronize: {
                configurationSection: 'languageServerExample'
            }
        };

        this.languageClient = new LanguageClient(
            'Rust Language Server',
            serverOptions,
            clientOptions
        );

        this.context = context;
    }

    public start(): void {
        this.languageClient.outputChannel.show();

        this.context.subscriptions.push(this.languageClient.start());
    }
}
