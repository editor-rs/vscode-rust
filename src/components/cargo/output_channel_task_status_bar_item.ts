import elegantSpinner = require('elegant-spinner');

import { StatusBarItem, window } from 'vscode';

export class OutputChannelTaskStatusBarItem {
    private stopStatusBarItem: StatusBarItem;

    private spinnerStatusBarItem: StatusBarItem;

    private interval: NodeJS.Timer | undefined;

    public constructor(stopCommandName: string) {
        this.stopStatusBarItem = window.createStatusBarItem();
        this.stopStatusBarItem.command = stopCommandName;
        this.stopStatusBarItem.text = 'Stop';
        this.stopStatusBarItem.tooltip = 'Click to stop running cargo task';

        this.spinnerStatusBarItem = window.createStatusBarItem();
        this.spinnerStatusBarItem.tooltip = 'Cargo task is running';
    }

    public show(): void {
        this.stopStatusBarItem.show();

        this.spinnerStatusBarItem.show();

        const spinner = elegantSpinner();

        const update = () => {
            this.spinnerStatusBarItem.text = spinner();
        };

        this.interval = setInterval(update, 100);
    }

    public hide(): void {
        if (this.interval !== undefined) {
            clearInterval(this.interval);

            this.interval = undefined;
        }

        this.stopStatusBarItem.hide();

        this.spinnerStatusBarItem.hide();
    }
}
