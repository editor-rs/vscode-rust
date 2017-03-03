import * as vscode from 'vscode';
import * as tmp from 'tmp';

import { ExtensionContext } from 'vscode';

import { ConfigurationManager } from '../configuration/configuration_manager';

import CurrentWorkingDirectoryManager from '../configuration/current_working_directory_manager';

import ChildLogger from '../logging/child_logger';

import CustomConfigurationChooser from './custom_configuration_chooser';

import { CommandStartHandleResult, Helper } from './helper';

import { OutputChannelTaskManager } from './output_channel_task_manager';

import { Task } from './task';

import { TerminalTaskManager } from './terminal_task_manager';

/**
 * Possible reasons of a cargo command invocation
 */
export enum CommandInvocationReason {
    /**
     * The command is invoked because the action on save is to execute the command
     */
    ActionOnSave,
    /**
     * The command is invoked because the corresponding registered command is executed
     */
    CommandExecution
}

export enum BuildType {
    Debug,
    Release
}

enum CrateType {
    Application,
    Library
}

export enum CheckTarget {
    Library,
    Application
}

class UserDefinedArgs {
    public static getBuildArgs(): string[] {
        const args = UserDefinedArgs.getArgs('buildArgs');

        return args;
    }

    public static getCheckArgs(): string[] {
        const args = UserDefinedArgs.getArgs('checkArgs');

        return args;
    }

    public static getClippyArgs(): string[] {
        const args = UserDefinedArgs.getArgs('clippyArgs');

        return args;
    }

    public static getDocArgs(): string[] {
        const args = UserDefinedArgs.getArgs('docArgs');

        return args;
    }

    public static getRunArgs(): string[] {
        const args = UserDefinedArgs.getArgs('runArgs');

        return args;
    }

    public static getTestArgs(): string[] {
        const args = UserDefinedArgs.getArgs('testArgs');

        return args;
    }

    private static getArgs(property: string): string[] {
        const configuration = getConfiguration();
        const args = configuration.get<string[]>(property);

        if (!args) {
            throw new Error(`Failed to get args for property=${property}`);
        }

        return args;
    }
}

class CargoTaskManager {
    private configurationManager: ConfigurationManager;

    private currentWorkingDirectoryManager: CurrentWorkingDirectoryManager;

    private logger: ChildLogger;

    private outputChannelTaskManager: OutputChannelTaskManager;

    private terminalTaskManager: TerminalTaskManager;

    public constructor(
        context: ExtensionContext,
        configurationManager: ConfigurationManager,
        currentWorkingDirectoryManager: CurrentWorkingDirectoryManager,
        logger: ChildLogger,
        stopCommandName: string
    ) {
        this.configurationManager = configurationManager;

        this.currentWorkingDirectoryManager = currentWorkingDirectoryManager;

        this.logger = logger;

        this.outputChannelTaskManager = new OutputChannelTaskManager(
            configurationManager,
            logger.createChildLogger('OutputChannelTaskManager: '),
            stopCommandName
        );

        this.terminalTaskManager = new TerminalTaskManager(context, configurationManager);
    }

    public async invokeCargoInit(crateType: CrateType, name: string, cwd: string): Promise<void> {
        const args = ['--name', name];

        switch (crateType) {
            case CrateType.Application:
                args.push('--bin');
                break;

            case CrateType.Library:
                args.push('--lib');
                break;

            default:
                throw new Error(`Unhandled crate type=${crateType}`);
        }

        this.outputChannelTaskManager.startTask('init', args, cwd, false, true);
    }

    public invokeCargoBuildWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.runCargo('build', args, true, reason);
    }

    public invokeCargoBuildUsingBuildArgs(reason: CommandInvocationReason): void {
        this.invokeCargoBuildWithArgs(UserDefinedArgs.getBuildArgs(), reason);
    }

    public invokeCargoCheckWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.checkCargoCheckAvailability().then(isAvailable => {
            let command: string;

            if (isAvailable) {
                command = 'check';
            } else {
                command = 'rustc';

                args = args.concat('--', '-Zno-trans');
            }

            this.runCargo(command, args, true, reason);
        });
    }

    public invokeCargoCheckUsingCheckArgs(reason: CommandInvocationReason): void {
        this.invokeCargoCheckWithArgs(UserDefinedArgs.getCheckArgs(), reason);
    }

    public invokeCargoClippyWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.runCargo('clippy', args, true, reason);
    }

    public invokeCargoClippyUsingClippyArgs(reason: CommandInvocationReason): void {
        this.invokeCargoClippyWithArgs(UserDefinedArgs.getClippyArgs(), reason);
    }

    public invokeCargoDocWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.runCargo('doc', args, true, reason);
    }

    public invokeCargoDocUsingDocArgs(reason: CommandInvocationReason): void {
        this.invokeCargoDocWithArgs(UserDefinedArgs.getDocArgs(), reason);
    }

    public async invokeCargoNew(projectName: string, isBin: boolean, cwd: string): Promise<void> {
        const args = [projectName, isBin ? '--bin' : '--lib'];

        await this.outputChannelTaskManager.startTask('new', args, cwd, false, true);
    }

    public invokeCargoRunWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.runCargo('run', args, true, reason);
    }

    public invokeCargoRunUsingRunArgs(reason: CommandInvocationReason): void {
        this.invokeCargoRunWithArgs(UserDefinedArgs.getRunArgs(), reason);
    }

    public invokeCargoTestWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.runCargo('test', args, true, reason);
    }

    public invokeCargoTestUsingTestArgs(reason: CommandInvocationReason): void {
        this.invokeCargoTestWithArgs(UserDefinedArgs.getTestArgs(), reason);
    }

    public invokeCargo(command: string, args: string[]): void {
        this.runCargo(command, args, true, CommandInvocationReason.CommandExecution);
    }

    public stopTask(): void {
        if (this.outputChannelTaskManager.hasRunningTask()) {
            this.outputChannelTaskManager.stopRunningTask();
        }
    }

    private async checkCargoCheckAvailability(): Promise<boolean> {
        const task = new Task(
            this.configurationManager,
            this.logger.createChildLogger('Task: '),
            ['check', '--help'],
            '/'
        );

        const exitCode = await task.execute();

        return exitCode === 0;
    }

    private async runCargo(command: string, args: string[], force: boolean, reason: CommandInvocationReason): Promise<void> {
        let cwd: string;

        try {
            cwd = await this.currentWorkingDirectoryManager.cwd();
        } catch (error) {
            vscode.window.showErrorMessage(error.message);

            return;
        }

        if (this.configurationManager.shouldExecuteCargoCommandInTerminal()) {
            this.terminalTaskManager.execute(command, args, cwd);
        } else {
            if (this.outputChannelTaskManager.hasRunningTask()) {
                if (!force) {
                    return;
                }

                const helper = new Helper(this.configurationManager);

                const result = await helper.handleCommandStartWhenThereIsRunningCommand();

                switch (result) {
                    case CommandStartHandleResult.IgnoreNewCommand:
                        return;

                    case CommandStartHandleResult.StopRunningCommand:
                        await this.outputChannelTaskManager.stopRunningTask();
                }
            }

            // The output channel should be shown only if the user wants that.
            // The only exception is checking invoked on saving the active document - in that case the output channel shouldn't be shown.
            const shouldShowOutputChannel: boolean =
                this.configurationManager.shouldShowRunningCargoTaskOutputChannel() &&
                !(command === 'check' && reason === CommandInvocationReason.ActionOnSave);

            await this.outputChannelTaskManager.startTask(command, args, cwd, true, shouldShowOutputChannel);
        }
    }
}

export class CargoManager {
    private cargoManager: CargoTaskManager;

    private customConfigurationChooser: CustomConfigurationChooser;

    private logger: ChildLogger;

    public constructor(
        context: ExtensionContext,
        configurationManager: ConfigurationManager,
        currentWorkingDirectoryManager: CurrentWorkingDirectoryManager,
        logger: ChildLogger
    ) {
        const stopCommandName = 'rust.cargo.terminate';

        this.cargoManager = new CargoTaskManager(
            context,
            configurationManager,
            currentWorkingDirectoryManager,
            logger.createChildLogger('CargoTaskManager: '),
            stopCommandName
        );

        this.customConfigurationChooser = new CustomConfigurationChooser(configurationManager);

        this.logger = logger;

        this.registerCommands(context, stopCommandName);
    }

    public executeBuildTask(reason: CommandInvocationReason): void {
        this.cargoManager.invokeCargoBuildUsingBuildArgs(reason);
    }

    public executeCheckTask(reason: CommandInvocationReason): void {
        this.cargoManager.invokeCargoCheckUsingCheckArgs(reason);
    }

    public executeClippyTask(reason: CommandInvocationReason): void {
        this.cargoManager.invokeCargoClippyUsingClippyArgs(reason);
    }

    public executeDocTask(reason: CommandInvocationReason): void {
        this.cargoManager.invokeCargoDocUsingDocArgs(reason);
    }

    public executeRunTask(reason: CommandInvocationReason): void {
        this.cargoManager.invokeCargoRunUsingRunArgs(reason);
    }

    public executeTestTask(reason: CommandInvocationReason): void {
        this.cargoManager.invokeCargoTestUsingTestArgs(reason);
    }

    private registerCommands(context: ExtensionContext, stopCommandName: string): void {
        // Cargo init
        context.subscriptions.push(this.registerCommandHelpingCreatePlayground('rust.cargo.new.playground'));

        // Cargo new
        context.subscriptions.push(this.registerCommandHelpingCreateProject('rust.cargo.new.bin', true));

        context.subscriptions.push(this.registerCommandHelpingCreateProject('rust.cargo.new.lib', false));

        // Cargo build
        context.subscriptions.push(this.registerCommandInvokingCargoBuildUsingBuildArgs('rust.cargo.build.default'));

        context.subscriptions.push(this.registerCommandHelpingChooseArgsAndInvokingCargoBuild('rust.cargo.build.custom'));

        // Cargo run
        context.subscriptions.push(this.registerCommandInvokingCargoRunUsingRunArgs('rust.cargo.run.default'));

        context.subscriptions.push(this.registerCommandHelpingChooseArgsAndInvokingCargoRun('rust.cargo.run.custom'));

        // Cargo test
        context.subscriptions.push(this.registerCommandInvokingCargoTestUsingTestArgs('rust.cargo.test.default'));

        context.subscriptions.push(this.registerCommandHelpingChooseArgsAndInvokingCargoTest('rust.cargo.test.custom'));

        // Cargo bench
        context.subscriptions.push(this.registerCommandInvokingCargoWithArgs('rust.cargo.bench', 'bench'));

        // Cargo doc
        context.subscriptions.push(this.registerCommandInvokingCargoDocUsingDocArgs('rust.cargo.doc.default'));

        context.subscriptions.push(this.registerCommandHelpingChooseArgsAndInvokingCargoDoc('rust.cargo.doc.custom'));

        // Cargo update
        context.subscriptions.push(this.registerCommandInvokingCargoWithArgs('rust.cargo.update', 'update'));

        // Cargo clean
        context.subscriptions.push(this.registerCommandInvokingCargoWithArgs('rust.cargo.clean', 'clean'));

        // Cargo check
        context.subscriptions.push(this.registerCommandInvokingCargoCheckUsingCheckArgs('rust.cargo.check.default'));

        context.subscriptions.push(this.registerCommandHelpingChooseArgsAndInvokingCargoCheck('rust.cargo.check.custom'));

        // Cargo clippy
        context.subscriptions.push(this.registerCommandInvokingCargoClippyUsingClippyArgs('rust.cargo.clippy.default'));

        context.subscriptions.push(this.registerCommandHelpingChooseArgsAndInvokingCargoClippy('rust.cargo.clippy.custom'));

        // Cargo terminate
        context.subscriptions.push(this.registerCommandStoppingCargoTask(stopCommandName));
    }

    public registerCommandHelpingCreatePlayground(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.helpCreatePlayground();
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoCheck(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.customConfigurationChooser.choose('customCheckConfigurations').then(args => {
                this.cargoManager.invokeCargoCheckWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoCheckUsingCheckArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.executeCheckTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoClippy(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.customConfigurationChooser.choose('customClippyConfigurations').then(args => {
                this.cargoManager.invokeCargoClippyWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoClippyUsingClippyArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.executeClippyTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoDoc(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.customConfigurationChooser.choose('customDocConfigurations').then(args => {
                this.cargoManager.invokeCargoDocWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoDocUsingDocArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.executeDocTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingCreateProject(commandName: string, isBin: boolean): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            const cwd = vscode.workspace.rootPath;

            if (!cwd) {
                vscode.window.showErrorMessage('Current document not in the workspace');

                return;
            }

            const projectType = isBin ? 'executable' : 'library';
            const placeHolder = `Enter ${projectType} project name`;

            vscode.window.showInputBox({ placeHolder: placeHolder }).then((name: string) => {
                if (!name || name.length === 0) {
                    return;
                }

                this.cargoManager.invokeCargoNew(name, isBin, cwd);
            });
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoBuild(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.customConfigurationChooser.choose('customBuildConfigurations').then(args => {
                this.cargoManager.invokeCargoBuildWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoBuildUsingBuildArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.executeBuildTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoRun(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.customConfigurationChooser.choose('customRunConfigurations').then(args => {
                this.cargoManager.invokeCargoRunWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoRunUsingRunArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.executeRunTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoTest(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.customConfigurationChooser.choose('customTestConfigurations').then(args => {
                this.cargoManager.invokeCargoTestWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoTestUsingTestArgs(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.executeTestTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandInvokingCargoWithArgs(commandName: string, command: string, ...args: string[]): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.invokeCargo(command, args);
        });
    }

    public registerCommandStoppingCargoTask(commandName: string): vscode.Disposable {
        return vscode.commands.registerCommand(commandName, () => {
            this.cargoManager.stopTask();
        });
    }

    private helpCreatePlayground(): void {
        const logger = this.logger.createChildLogger('helpCreatePlayground: ');

        const playgroundProjectTypes = ['application', 'library'];

        vscode.window.showQuickPick(playgroundProjectTypes)
            .then((playgroundProjectType: string | undefined) => {
                if (!playgroundProjectType) {
                    logger.debug('quick pick has been cancelled');

                    return;
                }

                tmp.dir((err, path) => {
                    if (err) {
                        this.logger.error(`Temporary directory creation failed: ${err}`);

                        vscode.window.showErrorMessage('Temporary directory creation failed');

                        return;
                    }

                    const crateType = playgroundProjectType === 'application' ? CrateType.Application : CrateType.Library;

                    const name = `playground_${playgroundProjectType}`;

                    this.cargoManager.invokeCargoInit(crateType, name, path)
                        .then(() => {
                            const uri = vscode.Uri.parse(path);

                            vscode.commands.executeCommand('vscode.openFolder', uri, true);
                        });
                });
            });
    }
}

function getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('rust');
}
