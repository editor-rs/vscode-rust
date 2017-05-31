import { StatusBarAlignment, StatusBarItem, window } from 'vscode';

export class RacerStatusBarItem {
    private showErrorCommandName: string;

    private statusBarItem: StatusBarItem;

    public constructor(showErrorCommandName: string) {
        this.showErrorCommandName = showErrorCommandName;

        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    }

    public showTurnedOn(): void {
        this.setText('On');

        this.clearCommand();

        this.statusBarItem.show();
    }

    public showTurnedOff(): void {
        this.setText('Off');

        this.clearCommand();

        this.statusBarItem.show();
    }

    public showNotFound(): void {
        this.setText('Not found');

        this.clearCommand();

        this.statusBarItem.tooltip =
            'The "racer" command is not available. Make sure it is installed.';
        this.statusBarItem.show();
    }

    public showCrashed(): void {
        this.setText('Crashed');

        this.statusBarItem.tooltip = 'The racer process has stopped. Click to view error';
        this.statusBarItem.command = this.showErrorCommandName;
        this.statusBarItem.show();
    }

    private setText(text: string): void {
        this.statusBarItem.text = `Racer: ${text}`;
    }

    private clearCommand(): void {
        // It is workaround because currently the typoe of StatusBarItem.command is string.
        const statusBarItem: any = this.statusBarItem;
        statusBarItem.command = undefined;
    }
}
