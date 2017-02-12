import { ExtensionContext, Terminal, workspace, window } from 'vscode';

import { ConfigurationManager } from '../configuration/configuration_manager';

export class TerminalTaskManager {
    private configurationManager: ConfigurationManager;

    private runningTerminal: Terminal | undefined;

    public constructor(context: ExtensionContext, configurationManager: ConfigurationManager) {
        this.configurationManager = configurationManager;

        context.subscriptions.push(
            window.onDidCloseTerminal(closedTerminal => {
                if (closedTerminal === this.runningTerminal) {
                    this.runningTerminal = undefined;
                }
            })
        );
    }

    public execute(command: string, args: string[], cwd: string): void {
        if (this.runningTerminal) {
            window.showErrorMessage('Cannot execute task in a terminal because some task is already running');

            return;
        }

        this.runningTerminal = window.createTerminal('Cargo Task');

        // Change the current directory to a specified directory
        this.runningTerminal.sendText(`cd "${cwd}"`);

        const cargoPath = this.configurationManager.getCargoPath();

        // Start a requested command
        this.runningTerminal.sendText(`${cargoPath} ${command} ${args.join(' ')}`);

        this.runningTerminal.show();
    }
}
