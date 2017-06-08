import * as tmp from 'tmp';
import { Disposable, ExtensionContext, Uri, commands, window, workspace } from 'vscode';
import { Configuration } from '../configuration/Configuration';
import { CurrentWorkingDirectoryManager }
    from '../configuration/current_working_directory_manager';
import { ChildLogger } from '../logging/child_logger';
import { CargoTaskManager } from './CargoTaskManager';
import { CommandInvocationReason } from './CommandInvocationReason';
import { CrateType } from './CrateType';
import { CustomConfigurationChooser } from './custom_configuration_chooser';

export class CargoManager {
    private _cargoManager: CargoTaskManager;
    private _customConfigurationChooser: CustomConfigurationChooser;
    private _logger: ChildLogger;

    public constructor(
        context: ExtensionContext,
        configuration: Configuration,
        currentWorkingDirectoryManager: CurrentWorkingDirectoryManager,
        logger: ChildLogger
    ) {
        const stopCommandName = 'rust.cargo.terminate';
        this._cargoManager = new CargoTaskManager(
            context,
            configuration,
            currentWorkingDirectoryManager,
            logger.createChildLogger('CargoTaskManager: '),
            stopCommandName
        );
        this._customConfigurationChooser = new CustomConfigurationChooser(configuration);
        this._logger = logger;
        this.registerCommands(context, stopCommandName);
    }

    public executeBuildTask(reason: CommandInvocationReason): void {
        this._cargoManager.invokeCargoBuildUsingBuildArgs(reason);
    }

    public executeCheckTask(reason: CommandInvocationReason): void {
        this._cargoManager.invokeCargoCheckUsingCheckArgs(reason);
    }

    public executeClippyTask(reason: CommandInvocationReason): void {
        this._cargoManager.invokeCargoClippyUsingClippyArgs(reason);
    }

    public executeDocTask(reason: CommandInvocationReason): void {
        this._cargoManager.invokeCargoDocUsingDocArgs(reason);
    }

    public executeRunTask(reason: CommandInvocationReason): void {
        this._cargoManager.invokeCargoRunUsingRunArgs(reason);
    }

    public executeTestTask(reason: CommandInvocationReason): void {
        this._cargoManager.invokeCargoTestUsingTestArgs(reason);
    }

    public registerCommandHelpingCreatePlayground(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this.helpCreatePlayground();
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoCheck(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this._customConfigurationChooser.choose('customCheckConfigurations').then(args => {
                this._cargoManager.invokeCargoCheckWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoCheckUsingCheckArgs(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this.executeCheckTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoClippy(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this._customConfigurationChooser.choose('customClippyConfigurations').then(args => {
                this._cargoManager.invokeCargoClippyWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoClippyUsingClippyArgs(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this.executeClippyTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoDoc(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this._customConfigurationChooser.choose('customDocConfigurations').then(args => {
                this._cargoManager.invokeCargoDocWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoDocUsingDocArgs(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this.executeDocTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingCreateProject(commandName: string, isBin: boolean): Disposable {
        return commands.registerCommand(commandName, () => {
            const cwd = workspace.rootPath;
            if (!cwd) {
                window.showErrorMessage('Current document not in the workspace');
                return;
            }
            const projectType = isBin ? 'executable' : 'library';
            const placeHolder = `Enter ${projectType} project name`;
            window.showInputBox({ placeHolder: placeHolder }).then((name: string) => {
                if (!name || name.length === 0) {
                    return;
                }
                this._cargoManager.invokeCargoNew(name, isBin, cwd);
            });
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoBuild(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this._customConfigurationChooser.choose('customBuildConfigurations').then(args => {
                this._cargoManager.invokeCargoBuildWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoBuildUsingBuildArgs(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this.executeBuildTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoRun(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this._customConfigurationChooser.choose('customRunConfigurations').then(args => {
                this._cargoManager.invokeCargoRunWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoRunUsingRunArgs(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this.executeRunTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandHelpingChooseArgsAndInvokingCargoTest(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this._customConfigurationChooser.choose('customTestConfigurations').then(args => {
                this._cargoManager.invokeCargoTestWithArgs(args, CommandInvocationReason.CommandExecution);
            }, () => undefined);
        });
    }

    public registerCommandInvokingCargoTestUsingTestArgs(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this.executeTestTask(CommandInvocationReason.CommandExecution);
        });
    }

    public registerCommandInvokingCargoWithArgs(commandName: string, command: string, ...args: string[]): Disposable {
        return commands.registerCommand(commandName, () => {
            this._cargoManager.invokeCargo(command, args);
        });
    }

    public registerCommandStoppingCargoTask(commandName: string): Disposable {
        return commands.registerCommand(commandName, () => {
            this._cargoManager.stopTask();
        });
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

    private helpCreatePlayground(): void {
        const logger = this._logger.createChildLogger('helpCreatePlayground: ');
        const playgroundProjectTypes = ['application', 'library'];
        window.showQuickPick(playgroundProjectTypes)
            .then((playgroundProjectType: string | undefined) => {
                if (!playgroundProjectType) {
                    logger.debug('quick pick has been cancelled');
                    return;
                }
                tmp.dir((err, path) => {
                    if (err) {
                        this._logger.error(`Temporary directory creation failed: ${err}`);
                        window.showErrorMessage('Temporary directory creation failed');
                        return;
                    }
                    const crateType = playgroundProjectType === 'application' ? CrateType.Application : CrateType.Library;
                    const name = `playground_${playgroundProjectType}`;
                    this._cargoManager.invokeCargoInit(crateType, name, path)
                        .then(() => {
                            const uri = Uri.parse(path);

                            commands.executeCommand('openFolder', uri, true);
                        });
                });
            });
    }
}
