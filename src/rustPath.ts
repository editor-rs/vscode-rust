import vscode = require('vscode');

export function getRustLangSrcPath(): string {
	return vscode.workspace.getConfiguration('rust')['rustLangSrcPath'];
}

export function getRacerPath(): string {
	let racerPath = vscode.workspace.getConfiguration('rust')['racerPath']; 
	return racerPath.length > 0 ? racerPath : 'racer';
}