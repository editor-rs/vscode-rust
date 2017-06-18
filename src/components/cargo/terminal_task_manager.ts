import { ExtensionContext, Terminal, window, workspace } from 'vscode';
import { escapeSpaces, getCommandToSetEnvVar, parseShell } from '../../CommandLine';
import { Configuration } from '../configuration/Configuration';

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
        cwd = escapeSpaces(cwd, shell);
        // Change the current directory to a specified directory
        this._runningTerminal.sendText(`cd ${cwd}`);
        executable = escapeSpaces(executable, shell);
        args = args.map((arg) => escapeSpaces(arg, shell));
        // Start a requested command
        this._runningTerminal.sendText(`${executable} ${args.join(' ')}`);
        this._runningTerminal.show(true);
    }
}
