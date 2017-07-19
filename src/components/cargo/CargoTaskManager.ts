import { join } from 'path';
import { ExtensionContext, window } from 'vscode';
import { CargoInvocationManager } from '../../CargoInvocationManager';
import { ShellProviderManager } from '../../ShellProviderManager';
import { Configuration } from '../configuration/Configuration';
import { CurrentWorkingDirectoryManager }
    from '../configuration/current_working_directory_manager';
import { ChildLogger } from '../logging/child_logger';
import { CommandInvocationReason } from './CommandInvocationReason';
import { CrateType } from './CrateType';
import { CommandStartHandleResult, Helper } from './helper';
import { OutputChannelTaskManager } from './output_channel_task_manager';
import { TerminalTaskManager } from './terminal_task_manager';
import { UserDefinedArgs } from './UserDefinedArgs';

export class CargoTaskManager {
    private _configuration: Configuration;
    private _cargoInvocationManager: CargoInvocationManager;
    private _currentWorkingDirectoryManager: CurrentWorkingDirectoryManager;
    private _logger: ChildLogger;
    private _outputChannelTaskManager: OutputChannelTaskManager;
    private _terminalTaskManager: TerminalTaskManager;

    public constructor(
        context: ExtensionContext,
        configuration: Configuration,
        cargoInvocationManager: CargoInvocationManager,
        currentWorkingDirectoryManager: CurrentWorkingDirectoryManager,
        shellProviderManager: ShellProviderManager,
        logger: ChildLogger,
        stopCommandName: string
    ) {
        this._configuration = configuration;
        this._cargoInvocationManager = cargoInvocationManager;
        this._currentWorkingDirectoryManager = currentWorkingDirectoryManager;
        this._logger = logger;
        this._outputChannelTaskManager = new OutputChannelTaskManager(
            configuration,
            logger.createChildLogger('OutputChannelTaskManager: '),
            stopCommandName
        );
        this._terminalTaskManager = new TerminalTaskManager(
            context,
            configuration,
            shellProviderManager
        );
    }

    public async invokeCargoInit(crateType: CrateType, name: string, workingDirectory: string): Promise<void> {
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
        await this.processRequestToStartTask(
            'init',
            args,
            workingDirectory,
            true,
            CommandInvocationReason.CommandExecution,
            false,
            false,
            false
        );
    }

    public invokeCargoBuildWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.runCargo('build', args, true, reason);
    }

    public invokeCargoBuildUsingBuildArgs(reason: CommandInvocationReason): void {
        this.invokeCargoBuildWithArgs(UserDefinedArgs.getBuildArgs(), reason);
    }

    public invokeCargoCheckWithArgs(args: string[], reason: CommandInvocationReason): void {
        this.runCargo('check', args, true, reason);
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

    public async invokeCargoNew(projectName: string, isBin: boolean, workingDirectory: string): Promise<void> {
        const args = [projectName, isBin ? '--bin' : '--lib'];
        await this.processRequestToStartTask(
            'new',
            args,
            workingDirectory,
            true,
            CommandInvocationReason.CommandExecution,
            false,
            false,
            false
        );
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
        if (this._outputChannelTaskManager.hasRunningTask()) {
            this._outputChannelTaskManager.stopRunningTask();
        }
    }

    private async processRequestToStartTask(
        command: string,
        args: string[],
        workingDirectory: string,
        isStoppingRunningTaskAllowed: boolean,
        reason: CommandInvocationReason,
        shouldStartTaskInTerminal: boolean,
        shouldUseUserWorkingDirectory: boolean,
        shouldParseOutput: boolean
    ): Promise<void> {
        const canStartTask = this.processPossiblyRunningTask(
            isStoppingRunningTaskAllowed,
            shouldStartTaskInTerminal
        );
        if (!canStartTask) {
            return;
        }
        if (shouldUseUserWorkingDirectory) {
            ({ args, workingDirectory } = this.processPossibleUserRequestToChangeWorkingDirectory(
                args,
                workingDirectory
            ));
        }
        const { executable, args: preCommandArgs } = this._cargoInvocationManager.getExecutableAndArgs();
        this.startTask(
            executable,
            preCommandArgs,
            command,
            args,
            workingDirectory,
            reason,
            shouldStartTaskInTerminal,
            shouldParseOutput
        );
    }

    private async runCargo(
        command: string,
        args: string[],
        force: boolean,
        reason: CommandInvocationReason
    ): Promise<void> {
        let workingDirectory: string;
        try {
            workingDirectory = await this._currentWorkingDirectoryManager.cwd();
        } catch (error) {
            window.showErrorMessage(error.message);
            return;
        }
        const shouldExecuteCargoCommandInTerminal = this._configuration.shouldExecuteCargoCommandInTerminal();
        this.processRequestToStartTask(
            command,
            args,
            workingDirectory,
            force,
            reason,
            shouldExecuteCargoCommandInTerminal,
            true,
            true
        );
    }

    /**
     * Checks whether some task is running and it is, then checks whether it can be stopped
     * @param isStoppingRunningTaskAllowed The flag indicating whether the currently running task
     * can be stopped
     * @param isPossiblyRunningTaskRunInTerminal The flag indicating whether the currently
     * running task is run in the terminal
     * @return The flag inidicating whether there is no running task (there was no running task or
     * the running task has been stopped)
     */
    private async processPossiblyRunningTask(
        isStoppingRunningTaskAllowed: boolean,
        isPossiblyRunningTaskRunInTerminal: boolean
    ): Promise<boolean> {
        let hasRunningTask = false;
        if (isPossiblyRunningTaskRunInTerminal) {
            hasRunningTask = this._terminalTaskManager.hasRunningTask();
        } else {
            hasRunningTask = this._outputChannelTaskManager.hasRunningTask();
        }
        if (!hasRunningTask) {
            return true;
        }
        if (isStoppingRunningTaskAllowed) {
            return false;
        }
        let shouldStopRunningTask = false;
        const helper = new Helper(this._configuration);
        const result = await helper.handleCommandStartWhenThereIsRunningCommand();
        switch (result) {
            case CommandStartHandleResult.IgnoreNewCommand:
                break;
            case CommandStartHandleResult.StopRunningCommand:
                shouldStopRunningTask = true;
        }
        if (shouldStopRunningTask) {
            if (isPossiblyRunningTaskRunInTerminal) {
                this._terminalTaskManager.stopRunningTask();
            } else {
                this._outputChannelTaskManager.stopRunningTask();
            }
            return true;
        } else {
            return false;
        }
    }

    private async startTask(
        executable: string,
        preCommandArgs: string[],
        command: string,
        args: string[],
        cwd: string,
        reason: CommandInvocationReason,
        shouldExecuteCargoCommandInTerminal: boolean,
        shouldParseOutput: boolean
    ): Promise<void> {
        if (shouldExecuteCargoCommandInTerminal) {
            await this._terminalTaskManager.startTask(
                executable,
                preCommandArgs,
                command,
                args,
                cwd
            );
        } else {
            // The output channel should be shown only if the user wants that.
            // The only exception is checking invoked on saving the active document - in that case the output channel shouldn't be shown.
            const shouldShowOutputChannel: boolean =
                this._configuration.shouldShowRunningCargoTaskOutputChannel() &&
                !(command === 'check' && reason === CommandInvocationReason.ActionOnSave);
            await this._outputChannelTaskManager.startTask(
                executable,
                preCommandArgs,
                command,
                args,
                cwd,
                shouldParseOutput,
                shouldShowOutputChannel
            );
        }
    }

    /**
     * The user can specify some directory which Cargo commands should be run in. In this case,
     * Cargo should be known whether the correct manifest is located. The function checks whether
     * the user specify some directory and if it is, then adds the manifest path to the arguments
     * and replaces the working directory
     * @param args The arguments to change
     * @param workingDirectory The current working directory
     * @return The new arguments and new working directory
     */
    private processPossibleUserRequestToChangeWorkingDirectory(
        args: string[],
        workingDirectory: string
    ): { args: string[], workingDirectory: string } {
        const userWorkingDirectory = this._configuration.getCargoCwd();
        if (userWorkingDirectory !== undefined && userWorkingDirectory !== workingDirectory) {
            const manifestPath = join(workingDirectory, 'Cargo.toml');
            args = ['--manifest-path', manifestPath].concat(args);
            workingDirectory = userWorkingDirectory;
        }
        return { args, workingDirectory };
    }
}
