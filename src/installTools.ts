import * as vscode from 'vscode';
import fs = require('fs');
import path = require('path');
import * as cp from 'child_process';
import PathService from './services/pathService';
import StatusBarService from './services/statusBarService';

let tools = {
    'racer': PathService.getRacerPath(),
    'rustfmt': PathService.getRustfmtPath(),
    'rustsym': PathService.getRustsymPath()
};

let channel = vscode.window.createOutputChannel('Rust Tool Installer');

function getMissingTools(): Promise<string[]> {
    const keys = Object.keys(tools);

    const promises = keys.map(tool => {
        // Check if the path exists as-is.
        let userPath = tools[tool];
        fs.exists(userPath, exists => {
            if (exists) {
                return Promise.resolve(null);
            }
        });

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
                return Promise.resolve(null);
            }
        }

        // The tool wasn't found, we should install it
        return Promise.resolve(tool);
    });

    return Promise.all(promises);
}

export default function offerToInstallTools(): void {
    getMissingTools().then(result => {
        const missingTools = result.filter(tool => tool != null);

        if (missingTools.length > 0) {
            vscode.commands.registerCommand('rust.install_tools', () => {
                const option = {
                    title: 'Install'
                };

                // Plurality is important. :')
                const group = missingTools.length > 1 ? 'them' : 'it';

                vscode.window.showInformationMessage(
                    `You are missing ${missingTools.join(', ')}. Would you like to install ${group}?`, option)
                    .then((selection) => {
                        if (selection === option) {
                            channel.clear();
                            channel.show();

                            missingTools.forEach(installTool);

                            StatusBarService.hideStatus();
                        }
                    });
            });

            StatusBarService.showStatus('Rust Tools Missing', 'rust.install_tools', 'Missing Rust tools used by RustyCode');
        }
    });
}

function installTool(tool: string): void {
    channel.appendLine(`Executing "cargo install ${tool}"`);
    let proc = cp.spawn(PathService.getCargoPath(), ['install', tool], { env: process.env });

    proc.stdout.on('data', data => {
        channel.append(data.toString());
    });

    proc.stderr.on('data', data => {
        channel.append(data.toString());
    });

    proc.on('err', err => {
        if (err.code === 'ENOENT') {
            vscode.window.showInformationMessage('The "cargo" command is not available. Make sure it is installed.');
        }
    });

    proc.on('exit', () => {
        proc.removeAllListeners();
        proc = null;
    });
}
