import * as vscode from 'vscode';
import fs = require('fs');
import path = require('path');
import {ChildLogger} from './logging/mod';
import PathService from './services/pathService';
import StatusBarService from './services/statusBarService';

let tools = {
    'racer': PathService.getRacerPath(),
    'rustfmt': PathService.getRustfmtPath(),
    'rustsym': PathService.getRustsymPath()
};

export class Installator {
    private logger: ChildLogger;

    public constructor(logger: ChildLogger) {
        this.logger = logger;
    }

    public addStatusBarItemIfSomeToolsAreMissing(): void {
        const missingTools = this.getMissingTools();

        if (missingTools.length === 0) {
            return;
        }

        this.addStatusBarItemWhichOffersToInstallMissingTools(missingTools);
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
        const cargoBinPath = PathService.getCargoPath();
        const command = missingTools.map(tool => `${cargoBinPath} install ${tool}`).join(' && ');

        terminal.sendText(command);
        terminal.show();

        StatusBarService.hideStatus();
    }

    private getMissingTools(): string[] {
        const logger = this.logger.createChildLogger('getMissingTools(): ');

        const pathDirectories: string[] = (process.env.PATH || '').split(path.delimiter);

        logger.debug(`pathDirectories=${JSON.stringify(pathDirectories)}`);

        const keys = Object.keys(tools);

        const missingTools: (string | null)[] = keys.map(tool => {
            // Check if the path exists as-is.
            let userPath = tools[tool];
            if (fs.existsSync(userPath)) {
                logger.debug(`${tool}'s path=${userPath}`);

                return null;
            }

            // If the extension is running on Windows and no extension was
            // specified (likely because the user didn't configure a custom path),
            // then prefix one for them.
            if (process.platform === 'win32' && path.extname(userPath).length === 0) {
                userPath += '.exe';
            }

            // Check if the tool exists on the PATH
            for (const part of pathDirectories) {
                let binPath = path.join(part, userPath);

                if (fs.existsSync(binPath)) {
                    return null;
                }
            }

            // The tool wasn't found, we should install it
            return tool;
        }).filter(tool => tool !== null);

        logger.debug(`missingTools=${JSON.stringify(missingTools)}`);

        return missingTools;
    }
}
