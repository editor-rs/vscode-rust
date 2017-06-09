import { join } from 'path';
import { ExtensionContext, Terminal, window, workspace } from 'vscode';
import { escapeSpaces, getCommandToSetEnvVar, parseShell } from '../../CommandLine';
import { Configuration } from '../configuration/Configuration';
import { CommandStartHandleResult, Helper } from './helper';

export class TerminalTaskManager {
    private _configuration: Configuration;
    private _runningTerminal: Terminal | undefined;

    public constructor(context: ExtensionContext, configuration: Configuration) {
        this._configuration = configuration;
        context.subscriptions.push(
            window.onDidCloseTerminal(closedTerminal => {
                if (closedTerminal === this._runningTerminal) {
                    this._runningTerminal = undefined;
                }
            })
        );
    }

    public async execute(command: string, args: string[], cwd: string): Promise<void> {
        if (this._runningTerminal) {
            const helper = new Helper(this._configuration);
            const result = await helper.handleCommandStartWhenThereIsRunningCommand();
            switch (result) {
                case CommandStartHandleResult.IgnoreNewCommand:
                    return;
                case CommandStartHandleResult.StopRunningCommand:
                    this._runningTerminal.dispose();
                    this._runningTerminal = undefined;
            }
        }
        const terminal = window.createTerminal('Cargo Task');
        this._runningTerminal = terminal;
        const shell = parseShell(workspace.getConfiguration('terminal')['integrated']['shell']['windows']);
        const setEnvironmentVariables = () => {
            const cargoEnv = this._configuration.getCargoEnv();
            // Set environment variables
            for (const name in cargoEnv) {
                if (name in cargoEnv) {
                    const value = cargoEnv[name];
                    terminal.sendText(getCommandToSetEnvVar(shell, name, value));
                }
            }
        };
        setEnvironmentVariables();
        const cargoCwd = this._configuration.getCargoCwd();
        if (cargoCwd !== undefined && cargoCwd !== cwd) {
            const manifestPath = join(cwd, 'Cargo.toml');
            args = ['--manifest-path', manifestPath].concat(args);
            cwd = cargoCwd;
        }
        cwd = escapeSpaces(cwd, shell);
        // Change the current directory to a specified directory
        this._runningTerminal.sendText(`cd ${cwd}`);
        let cargoPath = this._configuration.getCargoPath();
        cargoPath = escapeSpaces(cargoPath, shell);
        args = args.map((arg) => escapeSpaces(arg, shell));
        command = escapeSpaces(command, shell);
        // Start a requested command
        this._runningTerminal.sendText(`${cargoPath} ${command} ${args.join(' ')}`);
        this._runningTerminal.show(true);
    }
}
