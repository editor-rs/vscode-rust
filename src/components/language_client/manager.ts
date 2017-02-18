import { ExtensionContext } from 'vscode';

import { LanguageClientOptions, LanguageClient, ServerOptions, State } from 'vscode-languageclient';

import ChildLogger from '../logging/child_logger';

import { StatusBarItem } from './status_bar_item';

export class Manager {
    private languageClient: LanguageClient;

    private statusBarItem: StatusBarItem;

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

        this.statusBarItem = new StatusBarItem(context);

        this.logger = logger;

        let serverEnv = Object.assign({}, process.env);

        if (env) {
            serverEnv = Object.assign(serverEnv, env);
        }

        const serverOptions: ServerOptions = {
            command: executable,
            args: args,
            options: { env: serverEnv }
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
    }

    public start(): void {
        this.logger.debug('start');

        this.languageClient.outputChannel.show();

        this.languageClient.onDidChangeState(event => {
            if (event.newState === State.Running) {
                this.languageClient.onNotification('rustDocument/diagnosticsBegin', () => {
                    this.statusBarItem.setText('Analysis started');
                });

                this.languageClient.onNotification('rustDocument/diagnosticsEnd', () => {
                    this.statusBarItem.setText('Analysis finished');
                });
            }
        });

        this.context.subscriptions.push(this.languageClient.start());

        this.statusBarItem.updateVisibility();
    }
}
