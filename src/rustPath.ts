import vscode = require('vscode');

export function getRustLangSrcPath(): string {
	return vscode.workspace.getConfiguration('rust')['rustLangSrcPath'];
}

export function getRacerPath(): string {
	return vscode.workspace.getConfiguration('rust')['racerPath'];
}

export function getRustfmtPath(): string {
	return vscode.workspace.getConfiguration('rust')['rustfmtPath'];
}