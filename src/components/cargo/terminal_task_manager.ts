import { join } from 'path';

import { ExtensionContext, Terminal, window, workspace } from 'vscode';

import { getCommandToSetEnvVar } from '../../CommandLine';

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

        const terminal = window.createTerminal('Cargo Task');

        this.runningTerminal = terminal;

        const setEnvironmentVariables = () => {
            const cargoEnv = this.configurationManager.getCargoEnv();

            const shell: string = workspace.getConfiguration('terminal')['integrated']['shell']['windows'];

            // Set environment variables
            for (let name in cargoEnv) {
                if (name in cargoEnv) {
                    const value = cargoEnv[name];

                    terminal.sendText(getCommandToSetEnvVar(shell, name, value));
                }
            }
        };

        setEnvironmentVariables();

        const cargoCwd = this.configurationManager.getCargoCwd();

        if (cargoCwd !== undefined && cargoCwd !== cwd) {
            const manifestPath = join(cwd, 'Cargo.toml');

            args = ['--manifest-path', manifestPath].concat(args);

            cwd = cargoCwd;
        }

        // Change the current directory to a specified directory
        this.runningTerminal.sendText(`cd "${cwd}"`);

        const cargoPath = this.configurationManager.getCargoPath();

        // Start a requested command
        this.runningTerminal.sendText(`${cargoPath} ${command} ${args.join(' ')}`);

        this.runningTerminal.show(true);
    }
}
