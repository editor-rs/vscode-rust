import { ExtensionContext, StatusBarAlignment, StatusBarItem, languages, window } from 'vscode';
import { getDocumentFilter } from '../configuration/mod';

export class MissingToolsStatusBarItem {
    private statusBarItem: StatusBarItem;
    private canBeShown: boolean;

    public constructor(context: ExtensionContext, statusBarItemCommand: string) {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
        this.statusBarItem.color = 'yellow';
        this.statusBarItem.command = statusBarItemCommand;
        this.statusBarItem.text = 'Rust Tools Missing';
        this.statusBarItem.tooltip = 'Missing Rust tools';
        this.canBeShown = false;
        context.subscriptions.push(
            window.onDidChangeActiveTextEditor(() => {
                this.updateStatusBarItemVisibility();
            })
        );
    }

    public show(): void {
        this.statusBarItem.show();
        this.canBeShown = true;
    }

    public hide(): void {
        this.statusBarItem.hide();
        this.canBeShown = false;
    }

    public updateStatusBarItemVisibility(): void {
        if (!this.canBeShown) {
            return;
        }
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
