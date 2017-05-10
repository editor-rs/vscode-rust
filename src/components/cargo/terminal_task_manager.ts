import { join } from 'path';

import { ExtensionContext, Terminal, window, workspace } from 'vscode';

import { escapeSpaces, getCommandToSetEnvVar, parseShell } from '../../CommandLine';

import { CommandStartHandleResult, Helper } from './helper';

import { Configuration } from '../configuration/Configuration';

export class TerminalTaskManager {
    private configuration: Configuration;

    private runningTerminal: Terminal | undefined;

    public constructor(context: ExtensionContext, configuration: Configuration) {
        this.configuration = configuration;

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
            const helper = new Helper(this.configuration);

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

        const shell = parseShell(workspace.getConfiguration('terminal')['integrated']['shell']['windows']);
        const setEnvironmentVariables = () => {
            const cargoEnv = this.configuration.getCargoEnv();
            // Set environment variables
            for (const name in cargoEnv) {
                if (name in cargoEnv) {
                    const value = cargoEnv[name];
                    terminal.sendText(getCommandToSetEnvVar(shell, name, value));
                }
            }
        };

        setEnvironmentVariables();

        const cargoCwd = this.configuration.getCargoCwd();

        if (cargoCwd !== undefined && cargoCwd !== cwd) {
            const manifestPath = join(cwd, 'Cargo.toml');

            args = ['--manifest-path', manifestPath].concat(args);

            cwd = cargoCwd;
        }

        cwd = escapeSpaces(cwd, shell);
        // Change the current directory to a specified directory
        this.runningTerminal.sendText(`cd ${cwd}`);

        let cargoPath = this.configuration.getCargoPath();
        cargoPath = escapeSpaces(cargoPath, shell);
        args = args.map((arg) => escapeSpaces(arg, shell));
        command = escapeSpaces(command, shell);

        // Start a requested command
        this.runningTerminal.sendText(`${cargoPath} ${command} ${args.join(' ')}`);

        this.runningTerminal.show(true);
    }
}
