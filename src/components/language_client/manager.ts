import { Disposable, ExtensionContext, window, workspace } from 'vscode';

import { LanguageClient, RevealOutputChannelOn, State } from 'vscode-languageclient';

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
        args: string[] | undefined,
        env: any | undefined,
        revealOutputChannelOn: RevealOutputChannelOn
    ) {
        this.languageClientCreator = new LanguageClientCreator(executable, args, env, revealOutputChannelOn);

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

    public async stop(): Promise<void> {
        this.logger.debug('stop');

        this.statusBarItem.disable();

        if (this.languageClient.needsStop()) {
            await this.languageClient.stop();
        }

        this.languageClient.outputChannel.dispose();
    }

    /** Stops the running language client if any and starts a new one. */
    private async restart(): Promise<void> {
        const isAnyDocumentDirty = !workspace.textDocuments.every(t => !t.isDirty);

        if (isAnyDocumentDirty) {
            window.showErrorMessage('You have unsaved changes. Save or discard them and try to restart again');

            return;
        }

        await this.stop();

        this.languageClient = this.languageClientCreator.create();

        this.subscribeOnStateChanging();

        this.start();
    }

    private subscribeOnStateChanging(): void {
        this.languageClient.onDidChangeState(event => {
            if (event.newState === State.Running) {
                this.languageClient.onNotification({ method: 'rustDocument/diagnosticsBegin' }, () => {
                    this.statusBarItem.setText('Analysis started');
                });

                this.languageClient.onNotification({ method: 'rustDocument/diagnosticsEnd' }, () => {
                    this.statusBarItem.setText('Analysis finished');
                });
            } else {
                this.statusBarItem.setText('Stopped');
            }
        });
    }
}
