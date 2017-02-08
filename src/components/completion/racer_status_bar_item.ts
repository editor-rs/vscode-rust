import { StatusBarAlignment, StatusBarItem, window } from 'vscode';

export default class RacerStatusBarItem {
    private showErrorCommandName: string;

    private statusBarItem: StatusBarItem;

    public constructor(showErrorCommandName: string) {
        this.showErrorCommandName = showErrorCommandName;

        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    }

    public showTurnedOn(): void {
        this.setText('On');

        this.statusBarItem.command = null;
        this.statusBarItem.show();
    }

    public showTurnedOff(): void {
        this.setText('Off');

        this.statusBarItem.command = null;
        this.statusBarItem.show();
    }

    public showNotFound(): void {
        this.setText('Not found');

        this.statusBarItem.tooltip =
            'The "racer" command is not available. Make sure it is installed.';
        this.statusBarItem.command = null;
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
}
