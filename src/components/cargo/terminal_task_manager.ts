import { ExtensionContext, Terminal, window } from 'vscode';
import { getCommandForArgs, getCommandToChangeWorkingDirectory, getCommandToSetEnvVar }
    from '../../CommandLine';
import { ShellProviderManager } from '../../ShellProviderManager';
import { Configuration } from '../configuration/Configuration';

export class TerminalTaskManager {
    private _configuration: Configuration;
    private _runningTerminal: Terminal | undefined;
    private _shellProvider: ShellProviderManager;

    public constructor(
        context: ExtensionContext,
        configuration: Configuration,
        shellProviderManager: ShellProviderManager
    ) {
        this._configuration = configuration;
        this._shellProvider = shellProviderManager;
        context.subscriptions.push(
            window.onDidCloseTerminal(closedTerminal => {
                if (closedTerminal === this._runningTerminal) {
                    this._runningTerminal = undefined;
                }
            })
        );
    }

    /**
     * Returns whether some task is running
     */
    public hasRunningTask(): boolean {
        return this._runningTerminal !== undefined;
    }

    public stopRunningTask(): void {
        if (this._runningTerminal) {
            this._runningTerminal.dispose();
            this._runningTerminal = undefined;
        }
    }

    public async startTask(
        executable: string,
        preCommandArgs: string[],
        command: string,
        args: string[],
        cwd: string
    ): Promise<void> {
        args = preCommandArgs.concat(command, ...args);
        const terminal = window.createTerminal('Cargo Task');
        this._runningTerminal = terminal;
        const shell = await this._shellProvider.getValue();
        if (shell === undefined) {
            return;
        }
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
        // Change the current directory to a specified directory
        this._runningTerminal.sendText(getCommandToChangeWorkingDirectory(shell, cwd));
        // Start a requested command
        this._runningTerminal.sendText(getCommandForArgs(shell, [executable, ...args]));
        this._runningTerminal.show(true);
    }
}
