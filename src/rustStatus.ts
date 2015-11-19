'use strict';

import { RUST_MODE } from './rustMode';
import vscode = require('vscode');

let statusBarEntry: vscode.StatusBarItem;

export function showHideStatus() {
	if (!statusBarEntry)
		return;
	
	if (!vscode.window.activeTextEditor) {
		statusBarEntry.hide();
		return;
	}
	
	if (vscode.languages.match(RUST_MODE, vscode.window.activeTextEditor.document)) {
		statusBarEntry.show();
		return;
	}
	
	statusBarEntry.hide();
}

export function hideRustStatus() {
	statusBarEntry.dispose();
}

export function showRustStatus(message: string, command: string, tooltip?: string) {
	statusBarEntry = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Number.MIN_VALUE);
	statusBarEntry.text = message;
	statusBarEntry.command = command;
	statusBarEntry.color = '#b7410e';
	statusBarEntry.tooltip = tooltip;
	statusBarEntry.show();
}