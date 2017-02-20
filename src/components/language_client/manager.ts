import { ExtensionContext } from 'vscode';

import { LanguageClient, State } from 'vscode-languageclient';

import ChildLogger from '../logging/child_logger';

import { Creator as LanguageClientCreator } from './creator';

import { StatusBarItem } from './status_bar_item';

export class Manager {
    private languageClientCreator: LanguageClientCreator;

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
        this.languageClientCreator = new LanguageClientCreator(executable, args, env);

        this.context = context;

        this.statusBarItem = new StatusBarItem(context);

        this.logger = logger;

        let serverEnv = Object.assign({}, process.env);

        if (env) {
            serverEnv = Object.assign(serverEnv, env);
        }

        this.languageClient = this.languageClientCreator.create();
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
