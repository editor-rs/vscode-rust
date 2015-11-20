import vscode = require('vscode');

export function getRustLangSrcPath(): string {
	return vscode.workspace.getConfiguration('rust')['rustLangSrcPath'];
}

export function getRacerPath(): string {
	let racerPath = vscode.workspace.getConfiguration('rust')['racerPath'];
	if (racerPath.length > 0) return racerPath; 
	return 'racer';
}

export function getRustfmtPath(): string {
	let rusfmtPath = vscode.workspace.getConfiguration('rust')['rustfmtPath'];
	if (rusfmtPath.length > 0) return rusfmtPath;
	return 'rustfmt';
}