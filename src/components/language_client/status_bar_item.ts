import * as vscode from 'vscode';

import { ExtensionContext, languages, window } from 'vscode';

import getDocumentFilter from '../configuration/mod';

export class StatusBarItem {
    private statusBarItem: vscode.StatusBarItem;

    public constructor(context: ExtensionContext) {
        this.statusBarItem = window.createStatusBarItem();

        context.subscriptions.push(
            window.onDidChangeActiveTextEditor(() => {
                this.updateVisibility();
            })
        );
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
