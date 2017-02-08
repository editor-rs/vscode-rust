import { ExtensionContext, Terminal, window } from 'vscode';

export class TerminalTaskManager {
    private runningTerminal: Terminal | undefined;

    public constructor(context: ExtensionContext) {
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

        // Start a requested command
        this.runningTerminal.sendText(`cargo ${command} ${args.join(' ')}`);

        this.runningTerminal.show();
    }
}
