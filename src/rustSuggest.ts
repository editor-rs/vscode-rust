'use strict';

import vscode = require('vscode');
import cp = require('child_process');

export class RustCompletionItemProvider implements vscode.CompletionItemProvider {
	public provideCompletionItems(): Promise<vscode.CompletionItem[]> {
		return new Promise(function(resolve, reject) {
			
		});
	}
}