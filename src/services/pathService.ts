import vscode = require('vscode');

export default class PathService {
	public static getRacerPath(): string {
		let racerPath = vscode.workspace.getConfiguration('rust')['racerPath']; 
		return racerPath || 'racer';
	}
	
	public static getRustfmtPath(): string {
		let rusfmtPath = vscode.workspace.getConfiguration('rust')['rustfmtPath'];
		return rusfmtPath || 'rustfmt';
	}
	
	public static getRustLangSrcPath(): string {
		return vscode.workspace.getConfiguration('rust')['rustLangSrcPath'];
	}
}