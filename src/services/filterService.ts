import * as vscode from 'vscode';

export default class FilterService {
	public static getRustModeFilter(): vscode.DocumentFilter {
		return { language: 'rust', scheme: 'file' };
	}
}