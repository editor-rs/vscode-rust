import * as vscode from 'vscode';
import fs = require('fs');
import path = require('path');
import PathService from './services/pathService';
import StatusBarService from './services/statusBarService';

let tools = {
    'racer': PathService.getRacerPath(),
    'rustfmt': PathService.getRustfmtPath(),
    'rustsym': PathService.getRustsymPath()
};

export class Installator {
    public addStatusBarItemIfSomeToolsAreMissing(): void {
        this.getMissingTools().then(missingTools => {
            if (missingTools.length !== 0) {
                this.addStatusBarItemWhichOffersToInstallMissingTools(missingTools);
            }
        });
    }

    private addStatusBarItemWhichOffersToInstallMissingTools(missingTools: string[]): void {
        vscode.commands.registerCommand('rust.install_tools', () => this.offerToInstallMissingTools(missingTools));
        StatusBarService.showStatus('Rust Tools Missing', 'rust.install_tools', 'Missing Rust tools');
    }

    private offerToInstallMissingTools(missingTools: string[]): void {
        // Plurality is important. :')
        const group = missingTools.length > 1 ? 'them' : 'it';
        const message = `You are missing ${missingTools.join(', ')}. Would you like to install ${group}?`;
        const option = { title: 'Install' };

        vscode.window.showInformationMessage(message, option).then(selection => {
            if (selection !== option) {
                return;
            }

            this.installMissingTools(missingTools);
        });
    }

    private installMissingTools(missingTools: string[]): void {
        const terminal = vscode.window.createTerminal('Rust tools installation');
        // cargo install tool && cargo install another_tool
        const command = missingTools.map(tool => `cargo install ${tool}`).join(' && ');

        terminal.sendText(command);
        terminal.show();

        StatusBarService.hideStatus();
    }

    private getMissingTools(): Promise<string[]> {
        const keys = Object.keys(tools);

        const promises: Promise<string>[] = keys.map(tool => {
            // Check if the path exists as-is.
            let userPath = tools[tool];
            if (fs.existsSync(userPath)) {
                return null;
            }

            // If the extension is running on Windows and no extension was
            // specified (likely because the user didn't configure a custom path),
            // then prefix one for them.
            if (process.platform === 'win32' && path.extname(userPath).length === 0) {
                userPath += '.exe';
            }

            // Check if the tool exists on the PATH
            let parts = (process.env.PATH || '').split(path.delimiter);
            for (const part of parts) {
                let binPath = path.join(part, userPath);
                if (fs.existsSync(binPath)) {
                    return null;
                }
            }

            // The tool wasn't found, we should install it
            return Promise.resolve(tool);
        }).filter(p => p !== null);

        return Promise.all(promises);
    }
}
