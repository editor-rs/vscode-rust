'use strict';

import FilterService from './filterService';
import * as vscode from 'vscode';

export default class StatusBarService {
    private static statusBarEntry: vscode.StatusBarItem;

    public static hideStatus(): void {
        this.statusBarEntry.dispose();
    }

    public static showStatus(message: string, command: string, tooltip?: string): void {
        this.statusBarEntry = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Number.MIN_VALUE);
        this.statusBarEntry.text = message;
        this.statusBarEntry.command = command;
        this.statusBarEntry.color = 'yellow';
        this.statusBarEntry.tooltip = tooltip;
        this.statusBarEntry.show();
    }

    public static toggleStatus(): void {
        if (!this.statusBarEntry) {
            return;
        }

        if (!vscode.window.activeTextEditor) {
            this.statusBarEntry.hide();
            return;
        }

        if (vscode.languages.match(FilterService.getRustModeFilter(), vscode.window.activeTextEditor.document)) {
            this.statusBarEntry.show();
            return;
        }

        this.statusBarEntry.hide();
    }
}
