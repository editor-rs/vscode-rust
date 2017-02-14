import { ExtensionContext, Terminal, window, workspace } from 'vscode';

import { CommandStartHandleResult, Helper } from './helper';

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

    public async execute(command: string, args: string[], cwd: string): Promise<void> {
        if (this.runningTerminal) {
            const helper = new Helper(this.configurationManager);

            const result = await helper.handleCommandStartWhenThereIsRunningCommand();

            switch (result) {
                case CommandStartHandleResult.IgnoreNewCommand:
            return;

                case CommandStartHandleResult.StopRunningCommand:
                    this.runningTerminal.dispose();
                    this.runningTerminal = undefined;
            }
        }

        this.runningTerminal = window.createTerminal('Cargo Task');

        const setEnvironmentVariables = () => {
            const cargoEnv = this.configurationManager.getCargoEnv();

            const setEnvironmentVariable = (() => {
                if (process.platform !== 'win32') {
                    return (name: string, value: string) => {
                        this.runningTerminal.sendText(`export ${name}="${value}"`);
                    };
                }

                const shell: string = workspace.getConfiguration('terminal')['integrated']['shell']['windows'];

                if (shell.includes('powershell')) {
                    return (name: string, value: string) => {
                        this.runningTerminal.sendText(`$ENV:${name}="${value}"`);
                    };
                } else if (shell.includes('cmd')) {
                    return (name: string, value: string) => {
                        this.runningTerminal.sendText(`set ${name}=${value}`);
                    };
                } else {
                    return (name: string, value: string) => {
                        this.runningTerminal.sendText(`export ${name}="${value}"`);
                    };
                }
            })();

            // Set environment variables
            for (let name in cargoEnv) {
                if (name in cargoEnv) {
                    const value = cargoEnv[name];

                    setEnvironmentVariable(name, value);
                }
            }
        };

        setEnvironmentVariables();

        // Change the current directory to a specified directory
        this.runningTerminal.sendText(`cd "${cwd}"`);

        const cargoPath = this.configurationManager.getCargoPath();

        // Start a requested command
        this.runningTerminal.sendText(`${cargoPath} ${command} ${args.join(' ')}`);

        this.runningTerminal.show(true);
    }
}
