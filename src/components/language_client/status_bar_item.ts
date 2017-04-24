import * as vscode from 'vscode';

import { ExtensionContext, commands, window } from 'vscode';

const command = 'rust.LanguageClient.StatusBarItem.Clicked';

export class StatusBarItem {
    private statusBarItem: vscode.StatusBarItem;
    private onClicked?: () => void;

    public constructor(context: ExtensionContext) {
        this.statusBarItem = window.createStatusBarItem();

        context.subscriptions.push(
            commands.registerCommand(command, () => {
                if (this.onClicked !== undefined) {
                    this.onClicked();
                }
            })
        );
    }

    /**
     * Disallows the user to click on the indicator
     */
    public disable(): void {
        // There is an error in the definition of StatusBarItem.command.
        // The expected type is `string | undefined`, but actual is `string`.
        // This is workaround.
        const statusBarItem: any = this.statusBarItem;
        // Disable clicking.
        statusBarItem.command = undefined;
        // Remove tooltip because we don't want to say the user that we may click on the indicator which is disabled
        statusBarItem.tooltip = undefined;
    }

    /**
     * Allows the user to click on the indicator
     */
    public enable(): void {
        this.statusBarItem.command = command;
        this.statusBarItem.tooltip = 'Click to restart';
    }

    /**
     * Saves the specified closure as a closure which is invoked when the user clicks on the indicator
     * @param onClicked closure to be invoked
     */
    public setOnClicked(onClicked: () => void | undefined): void {
        this.onClicked = onClicked;
    }

    /**
     * Makes the indicator show the specified text in the format "RLS: ${text}"
     * @param text the text to be shown
     */
    public setText(text: string): void {
        this.statusBarItem.text = `RLS: ${text}`;
    }

    /**
     * Shows the indicator in the status bar
     */
    public show(): void {
        this.statusBarItem.show();
    }
}
