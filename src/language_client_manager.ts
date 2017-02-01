import { ExtensionContext } from 'vscode';

import { LanguageClientOptions, LanguageClient, ServerOptions } from 'vscode-languageclient';

import ChildLogger from './components/logging/child_logger';

export default class LanguageClientManager {
    private languageClient: LanguageClient;

    private context: ExtensionContext;

    private logger: ChildLogger;

    public constructor(
        context: ExtensionContext,
        logger: ChildLogger,
        executable: string,
        args?: string[],
        env?: any
    ) {
        this.context = context;

        this.logger = logger;

        const serverOptions: ServerOptions = {
            command: executable,
            args: args,
            options: { env: process.env }
        };

        if (env) {
            serverOptions.options.env = Object.assign(serverOptions.options.env, env);
        }

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
    }

    public start(): void {
        this.logger.debug('start');

        this.languageClient.outputChannel.show();

        this.context.subscriptions.push(this.languageClient.start());
    }
}
