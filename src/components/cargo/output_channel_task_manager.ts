import { window } from 'vscode';

import { ConfigurationManager } from '../configuration/configuration_manager';

import { DiagnosticParser } from './diagnostic_parser';

import { DiagnosticPublisher } from './diagnostic_publisher';

import { OutputChannelWrapper } from './output_channel_wrapper';

import { OutputChannelTaskStatusBarItem } from './output_channel_task_status_bar_item';

import { Task } from './task';

export class OutputChannelTaskManager {
    private channel: OutputChannelWrapper;

    private configurationManager: ConfigurationManager;

    private runningTask: Task | undefined;

    private diagnosticParser: DiagnosticParser;

    private diagnosticPublisher: DiagnosticPublisher;

    private statusBarItem: OutputChannelTaskStatusBarItem;

    public constructor(configurationManager: ConfigurationManager, stopCommandName: string) {
        this.channel = new OutputChannelWrapper(window.createOutputChannel('Cargo'));

        this.configurationManager = configurationManager;

        this.diagnosticParser = new DiagnosticParser();

        this.diagnosticPublisher = new DiagnosticPublisher();

        this.statusBarItem = new OutputChannelTaskStatusBarItem(stopCommandName);
    }

    public async startTask(
        command: string,
        args: string[],
        cwd: string,
        parseOutput: boolean
    ): Promise<void> {
        function extendArgs(): void {
            if (parseOutput) {
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

            // Prepare arguments with a command
            args = [command].concat(args);
        }

        extendArgs();

        this.runningTask = new Task(this.configurationManager, args, cwd);

        this.runningTask.setStarted(() => {
            this.channel.clear();
            this.channel.append(`Started cargo ${args.join(' ')}\n\n`);
        });

        this.runningTask.setLineReceivedInStdout(line => {
            if (parseOutput && line.startsWith('{')) {
                const fileDiagnostics = this.diagnosticParser.parseLine(line);

                for (const fileDiagnostic of fileDiagnostics) {
                    this.diagnosticPublisher.publishDiagnostic(fileDiagnostic, cwd);
                }
            } else {
                this.channel.append(`${line}\n`);
            }
        });

        this.runningTask.setLineReceivedInStderr(line => {
            this.channel.append(`${line}\n`);
        });

        if (this.configurationManager.shouldShowRunningCargoTaskOutputChannel()) {
            this.channel.show();
        }

        this.statusBarItem.show();

        let exitCode;

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
        await this.runningTask.kill();
    }
}
