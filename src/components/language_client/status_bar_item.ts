import * as vscode from 'vscode';

import { ExtensionContext, commands, languages, window } from 'vscode';

import getDocumentFilter from '../configuration/mod';

const command = 'rust.LanguageClient.StatusBarItem.Clicked';

export class StatusBarItem {
    private statusBarItem: vscode.StatusBarItem;
    private onClicked?: () => void;

    public constructor(context: ExtensionContext) {
        this.statusBarItem = window.createStatusBarItem();
        this.statusBarItem.tooltip = 'Click to restart';

        context.subscriptions.push(
            commands.registerCommand(command, () => {
                if (this.onClicked !== undefined) {
                    this.onClicked();
                }
            })
        );

        context.subscriptions.push(
            window.onDidChangeActiveTextEditor(() => {
                this.updateVisibility();
            })
        );
    }

    /** Disables clicking on the status bar item */
    public disable(): void {
        // There is an error in the definition of StatusBarItem.command.
        // The expected type is `string | undefined`, but actual is `string`.
        // This is workaround.
        let statusBarItem: any = this.statusBarItem;
        // Disable clicking.
        statusBarItem.command = undefined;
    }

    /** Enables clicking on the status bar item */
    public enable(): void {
        this.statusBarItem.command = command;
    }

    public setOnClicked(onClicked?: () => void): void {
        this.onClicked = onClicked;
    }

    public setText(text: string): void {
        this.statusBarItem.text = `RLS: ${text}`;
    }

    public updateVisibility(): void {
        if (!window.activeTextEditor) {
            this.statusBarItem.hide();

            return;
        }

        if (languages.match(getDocumentFilter(), window.activeTextEditor.document)) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
}
