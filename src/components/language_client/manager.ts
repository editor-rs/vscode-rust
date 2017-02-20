import { Disposable, ExtensionContext, window, workspace } from 'vscode';

import { LanguageClient, State } from 'vscode-languageclient';

import ChildLogger from '../logging/child_logger';

import { Creator as LanguageClientCreator } from './creator';

import { StatusBarItem } from './status_bar_item';

export class Manager {
    private languageClientCreator: LanguageClientCreator;

    private languageClient: LanguageClient;

    private statusBarItem: StatusBarItem;

    private logger: ChildLogger;

    public constructor(
        context: ExtensionContext,
        logger: ChildLogger,
        executable: string,
        args?: string[],
        env?: any
    ) {
        this.languageClientCreator = new LanguageClientCreator(executable, args, env);

        this.languageClient = this.languageClientCreator.create();

        this.statusBarItem = new StatusBarItem(context);

        this.statusBarItem.setOnClicked(() => {
            this.restart();
        });

        this.logger = logger;

        this.subscribeOnStateChanging();

        context.subscriptions.push(new Disposable(() => {
            this.stop();
        }));
    }

    public start(): void {
        this.logger.debug('start');

        this.languageClient.start();

        this.statusBarItem.updateVisibility();

        this.statusBarItem.enable();
    }

    public stop(): void {
        this.logger.debug('stop');

        this.statusBarItem.disable();

        if (this.languageClient.needsStop()) {
            this.languageClient.stop();
        }
    }

    /** Stops the running language client if any and starts a new one. */
    private restart(): void {
        const isAnyDocumentDirty = !workspace.textDocuments.every(t => !t.isDirty);

        if (isAnyDocumentDirty) {
            window.showErrorMessage('You have unsaved changes. Save or discard them and try to restart again');

            return;
        }

        this.stop();

        this.languageClient = this.languageClientCreator.create();

        this.subscribeOnStateChanging();

        this.start();
    }

    private subscribeOnStateChanging(): void {
        this.languageClient.onDidChangeState(event => {
            if (event.newState === State.Running) {
                this.languageClient.outputChannel.show();

                this.languageClient.onNotification('rustDocument/diagnosticsBegin', () => {
                    this.statusBarItem.setText('Analysis started');
                });

                this.languageClient.onNotification('rustDocument/diagnosticsEnd', () => {
                    this.statusBarItem.setText('Analysis finished');
                });
            } else {
                this.statusBarItem.setText('Stopped');
            }
        });
    }
}
