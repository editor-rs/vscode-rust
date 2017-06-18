import { DiagnosticCollection, languages, window } from 'vscode';
import { Configuration } from '../configuration/Configuration';
import { ChildLogger } from '../logging/child_logger';
import { DiagnosticParser } from './diagnostic_parser';
import { normalizeDiagnosticPath, addUniqueDiagnostic } from './diagnostic_utils';
import { OutputChannelWrapper } from './output_channel_wrapper';
import { OutputChannelTaskStatusBarItem } from './output_channel_task_status_bar_item';
import { ExitCode, Task } from './task';

export class OutputChannelTaskManager {
    private channel: OutputChannelWrapper;
    private configuration: Configuration;
    private logger: ChildLogger;
    private runningTask: Task | undefined;
    private diagnostics: DiagnosticCollection;
    private diagnosticParser: DiagnosticParser;
    private statusBarItem: OutputChannelTaskStatusBarItem;

    public constructor(
        configuration: Configuration,
        logger: ChildLogger,
        stopCommandName: string
    ) {
        this.channel = new OutputChannelWrapper(window.createOutputChannel('Cargo'));
        this.configuration = configuration;
        this.logger = logger;
        this.diagnostics = languages.createDiagnosticCollection('rust');
        this.diagnosticParser = new DiagnosticParser();
        this.statusBarItem = new OutputChannelTaskStatusBarItem(stopCommandName);
    }

    public async startTask(
        executable: string,
        preCommandArgs: string[],
        command: string,
        args: string[],
        cwd: string,
        parseOutput: boolean,
        shouldShowOutputChannnel: boolean
    ): Promise<void> {
        function prependArgsWithMessageFormatIfRequired(): void {
            if (!parseOutput) {
                return;
            }

            // Prepend arguments with arguments making cargo print output in JSON.
            switch (command) {
                case 'build':
                case 'check':
                case 'clippy':
                case 'test':
                case 'run':
                    args = ['--message-format', 'json'].concat(args);
                    break;
            }
        }
        prependArgsWithMessageFormatIfRequired();
        args = preCommandArgs.concat(command, ...args);
        this.runningTask = new Task(
            this.configuration,
            this.logger.createChildLogger('Task: '),
            executable,
            args,
            cwd
        );
        this.runningTask.setStarted(() => {
            this.channel.clear();
            this.channel.append(`Working directory: ${cwd}\n`);
            this.channel.append(`Started ${executable} ${args.join(' ')}\n\n`);
            this.diagnostics.clear();
        });
        this.runningTask.setLineReceivedInStdout(line => {
            if (parseOutput && line.startsWith('{')) {
                const fileDiagnostics = this.diagnosticParser.parseLine(line);
                for (const fileDiagnostic of fileDiagnostics) {
                    fileDiagnostic.filePath = normalizeDiagnosticPath(fileDiagnostic.filePath, cwd);
                    addUniqueDiagnostic(fileDiagnostic, this.diagnostics);
                }
            } else {
                this.channel.append(`${line}\n`);
            }
        });
        this.runningTask.setLineReceivedInStderr(line => {
            this.channel.append(`${line}\n`);
        });
        if (shouldShowOutputChannnel) {
            this.channel.show();
        }
        this.statusBarItem.show();
        let exitCode: ExitCode;
        try {
            exitCode = await this.runningTask.execute();
        } catch (error) {
            this.statusBarItem.hide();
            this.runningTask = undefined;
            // No error means the task has been interrupted
            if (error && error.message === 'ENOENT') {
                const message = 'The "cargo" command is not available. Make sure it is installed.';
                window.showInformationMessage(message);
            }
            return;
        }
        this.statusBarItem.hide();
        this.runningTask = undefined;
        this.channel.append(`\nCompleted with code ${exitCode}\n`);
    }

    public hasRunningTask(): boolean {
        return this.runningTask !== undefined;
    }

    public async stopRunningTask(): Promise<void> {
        if (this.runningTask !== undefined) {
            await this.runningTask.kill();
        }
    }
}
