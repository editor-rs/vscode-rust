import { SpawnOptions } from 'child_process';

import { WorkspaceConfiguration, workspace } from 'vscode';

import { RevealOutputChannelOn } from 'vscode-languageclient';

import expandTilde = require('expand-tilde');

import { OutputtingProcess } from '../../OutputtingProcess';

import { FileSystem } from '../file_system/FileSystem';

import ChildLogger from '../logging/child_logger';

import { Rustup } from './Rustup';

import { NotRustup } from './NotRustup';

export interface RlsConfiguration {
    args?: string[];

    env?: any;

    revealOutputChannelOn: RevealOutputChannelOn;
}

export enum ActionOnStartingCommandIfThereIsRunningCommand {
    StopRunningCommand,
    IgnoreNewCommand,
    ShowDialogToLetUserDecide
}

/**
 * The main class of the component `Configuration`.
 * This class contains code related to Configuration
 */
export class Configuration {
    private logger: ChildLogger;

    private rustInstallation: Rustup | NotRustup | undefined;

    /**
     * A path to Rust's source code specified by a user.
     * It contains a value of either:
     *   - the configuration parameter `rust.rustLangSrcPath`
     *   - the environment variable `RUST_SRC_PATH`
     * The path has higher priority than a path to Rust's source code contained within an installation
     */
    private pathToRustSourceCodeSpecifiedByUser: string | undefined;

    /**
     * A path to the executable of RLS specified by a user.
     * A user can specify it via the configuration parameter `rust.rls.executable`
     * The path has higher priority than a path found automatically
     */
    private pathToRlsSpecifiedByUser: string | undefined;

    /**
     * Creates a new instance of the class.
     * This method is asynchronous because it works with the file system
     * @param logger a logger to log messages
     */
    public static async create(logger: ChildLogger): Promise<Configuration> {
        const rustcSysRoot: string | undefined = await this.loadRustcSysRoot();

        const createRustInstallationPromise = async () => {
            if (!rustcSysRoot) {
                return undefined;
            }

            if (Rustup.doesManageRustcSysRoot(rustcSysRoot)) {
                return await Rustup.create(logger.createChildLogger('Rustup: '), rustcSysRoot);
            } else {
                return new NotRustup(rustcSysRoot);
            }
        };

        const rustInstallation: Rustup | NotRustup | undefined = await createRustInstallationPromise();

        const pathToRustSourceCodeSpecifiedByUser = await this.checkPathToRustSourceCodeSpecifiedByUser();

        const configuration = new Configuration(
            logger,
            rustInstallation,
            pathToRustSourceCodeSpecifiedByUser,
            undefined
        );

        configuration.updatePathToRlsExecutableSpecifiedByUser();

        return configuration;
    }

    /**
     * Returns either a path to the executable of RLS or undefined
     */
    public getPathToRlsExecutable(): string | undefined {
        if (this.pathToRlsSpecifiedByUser) {
            return this.pathToRlsSpecifiedByUser;
        }

        if (this.rustInstallation instanceof Rustup) {
            const pathToRlsExecutable = this.rustInstallation.getPathToRlsExecutable();

            if (pathToRlsExecutable) {
                return pathToRlsExecutable;
            }
        }

        return undefined;
    }

    /**
     * Returns a list of arguments to spawn RLS with
     * Possible values are:
     * * A list of arguments specified by a user with the configuration parameter `rust.rls.args`
     * * undefined
     */
    public getRlsArgs(): string[] | undefined {
        const rlsConfiguration = this.getRlsConfiguration();

        if (!rlsConfiguration) {
            return undefined;
        }

        const rlsArgs = rlsConfiguration.args;

        return rlsArgs;
    }

    /**
     * Returns an object representing an environment to run RLS in.
     * Possible values are:
     * * A value of the configuration parameter `rust.rls.env`
     * * An empty object
     * This method also tries to set RUST_SRC_PATH for any possible value
     */
    public getRlsEnv(): object {
        const rlsConfiguration: any | undefined = this.getRlsConfiguration();

        let rlsEnv: any = {};

        if (rlsConfiguration) {
            const rlsEnvSpecifiedByUser = rlsConfiguration.env;

            if (rlsEnvSpecifiedByUser) {
                rlsEnv = rlsEnvSpecifiedByUser;
            }
        }

        if (!rlsEnv.RUST_SRC_PATH) {
            rlsEnv.RUST_SRC_PATH = this.getRustSourcePath();
        }

        return rlsEnv;
    }

    /**
     * Returns a mode specifying for which kinds of messages the RLS output channel should be revealed
     * The possible values are (the higher the greater priority):
     * * A value specified by a user with the configuration parameter `rust.rls.revealOutputChannelOn`
     * * A default value which is on error
     */
    public getRlsRevealOutputChannelOn(): RevealOutputChannelOn {
        const rlsConfiguration: any | undefined = this.getRlsConfiguration();

        const defaultValue = RevealOutputChannelOn.Error;

        if (!rlsConfiguration) {
            return defaultValue;
        }

        const valueSpecifiedByUser = rlsConfiguration.revealOutputChannelOn;

        switch (valueSpecifiedByUser) {
            case 'info':
                return RevealOutputChannelOn.Info;

            case 'warn':
                return RevealOutputChannelOn.Warn;

            case 'error':
                return RevealOutputChannelOn.Error;

            case 'never':
                return RevealOutputChannelOn.Never;

            default:
                return defaultValue;
        }
    }

    private getRlsConfiguration(): any | undefined {
        const configuration = Configuration.getConfiguration();

        const rlsConfiguration: any = configuration['rls'];

        return rlsConfiguration;
    }

    public shouldExecuteCargoCommandInTerminal(): boolean {
        // When RLS is used any cargo command is executed in an integrated terminal.
        if (this.getRlsConfiguration() !== undefined) {
            return true;
        }

        const configuration = Configuration.getConfiguration();

        const shouldExecuteCargoCommandInTerminal = configuration['executeCargoCommandInTerminal'];

        return shouldExecuteCargoCommandInTerminal;
    }

    public getActionOnSave(): string | null {
        const actionOnSave = Configuration.getStringParameter('actionOnSave');

        return actionOnSave;
    }

    public getRustInstallation(): Rustup | NotRustup | undefined {
        return this.rustInstallation;
    }

    public shouldShowRunningCargoTaskOutputChannel(): boolean {
        const configuration = Configuration.getConfiguration();

        const shouldShowRunningCargoTaskOutputChannel = configuration['showOutput'];

        return shouldShowRunningCargoTaskOutputChannel;
    }

    public getCargoEnv(): any {
        const configuration = Configuration.getConfiguration();

        const cargoEnv = configuration['cargoEnv'];

        return cargoEnv || {};
    }

    public getCargoCwd(): string | undefined {
        const cargoCwd = Configuration.getPathConfigParameter('cargoCwd');

        return cargoCwd;
    }

    public getCargoPath(): string {
        const rustsymPath = Configuration.getPathConfigParameter('cargoPath');

        return rustsymPath || 'cargo';
    }

    public getCargoHomePath(): string | undefined {
        const configPath = Configuration.getPathConfigParameter('cargoHomePath');

        const envPath = Configuration.getPathEnvParameter('CARGO_HOME');

        return configPath || envPath || undefined;
    }

    public getRacerPath(): string {
        const racerPath = Configuration.getPathConfigParameter('racerPath');

        return racerPath || 'racer';
    }

    public getRustfmtPath(): string {
        const rustfmtPath = Configuration.getPathConfigParameter('rustfmtPath');

        return rustfmtPath || 'rustfmt';
    }

    public getRustsymPath(): string {
        const rustsymPath = Configuration.getPathConfigParameter('rustsymPath');

        return rustsymPath || 'rustsym';
    }

    public getRustSourcePath(): string | undefined {
        if (this.pathToRustSourceCodeSpecifiedByUser) {
            return this.pathToRustSourceCodeSpecifiedByUser;
        }

        if (this.rustInstallation instanceof Rustup) {
            return this.rustInstallation.getPathToRustSourceCode();
        }

        return undefined;
    }

    public getActionOnStartingCommandIfThereIsRunningCommand(): ActionOnStartingCommandIfThereIsRunningCommand {
        const configuration = Configuration.getConfiguration();

        const action = configuration['actionOnStartingCommandIfThereIsRunningCommand'];

        switch (action) {
            case 'Stop running command':
                return ActionOnStartingCommandIfThereIsRunningCommand.StopRunningCommand;

            case 'Show dialog to let me decide':
                return ActionOnStartingCommandIfThereIsRunningCommand.ShowDialogToLetUserDecide;

            default:
                return ActionOnStartingCommandIfThereIsRunningCommand.IgnoreNewCommand;
        }
    }

    public static getConfiguration(): WorkspaceConfiguration {
        const configuration = workspace.getConfiguration('rust');

        return configuration;
    }

    private static async loadRustcSysRoot(): Promise<string | undefined> {
        const executable = 'rustc';

        const args = ['--print', 'sysroot'];

        const options: SpawnOptions = { cwd: process.cwd() };

        const output = await OutputtingProcess.spawn(executable, args, options);

        if (output.success && output.exitCode === 0) {
            return output.stdoutData.trim();
        } else {
            return undefined;
        }
    }

    /**
     * Checks if a user specified a path to Rust's source code in the configuration and if it is, checks if the specified path does really exist
     * @return Promise which after resolving contains either a path if the path suits otherwise undefined
     */
    private static async checkPathToRustSourceCodeSpecifiedByUserInConfiguration(): Promise<string | undefined> {
        let configPath: string | undefined = this.getPathConfigParameter('rustLangSrcPath');

        if (configPath) {
            const configPathExists: boolean = await FileSystem.doesFileOrDirectoryExists(configPath);

            if (!configPathExists) {
                configPath = undefined;
            }
        }

        return configPath;
    }

    /**
     * Tries to find a path to Rust's source code specified by a user.
     * The method is asynchronous because it checks if a directory-candidate exists
     * It tries to find it in different places.
     * These places sorted by priority (the first item has the highest priority):
     * * User/Workspace configuration
     * * Environment
     */
    private static async checkPathToRustSourceCodeSpecifiedByUser(): Promise<string | undefined> {
        const configPath: string | undefined = await this.checkPathToRustSourceCodeSpecifiedByUserInConfiguration();

        if (configPath) {
            return configPath;
        }

        const envPath: string | undefined = this.getPathEnvParameter('RUST_SRC_PATH');

        const envPathExists: boolean = envPath !== undefined && await FileSystem.doesFileOrDirectoryExists(envPath);

        if (envPathExists) {
            return envPath;
        } else {
            return undefined;
        }
    }

    /**
     * Checks if a user specified a path to the executable of RLS via the configuration parameter.
     * It assigns either a path specified by a user or undefined, depending on if a user specified a path and the specified path exists.
     * This method is asynchronous because it checks if a path specified by a user exists
     */
    private async updatePathToRlsExecutableSpecifiedByUser(): Promise<void> {
        function getRlsExecutable(): string | undefined {
            const configuration = Configuration.getConfiguration();

            const rlsConfiguration = configuration['rls'];

            if (!rlsConfiguration) {
                return undefined;
            }

            const pathToRlsExecutable = rlsConfiguration.executable;

            if (!pathToRlsExecutable) {
                return undefined;
            }

            return expandTilde(pathToRlsExecutable);
        }

        const logger = this.logger.createChildLogger('updatePathToRlsSpecifiedByUser: ');

        const pathToRlsExecutable: string | undefined = getRlsExecutable();

        if (!pathToRlsExecutable) {
            this.pathToRlsSpecifiedByUser = undefined;

            return;
        }

        const doesPathToRlsExecutableExist: boolean = await FileSystem.doesFileOrDirectoryExists(pathToRlsExecutable);

        if (!doesPathToRlsExecutableExist) {
            logger.error(`The specified path does not exist. Path=${pathToRlsExecutable}`);

            this.pathToRlsSpecifiedByUser = undefined;

            return;
        }

        this.pathToRlsSpecifiedByUser = pathToRlsExecutable;
    }

    /**
     * Creates a new instance of the class.
     * The constructor is private because creating a new instance should be done via the method `create`
     * @param logger A value for the field `logger`
     * @param rustInstallation A value for the field `rustInstallation`
     * @param pathToRustSourceCodeSpecifiedByUser A value for the field `pathToRustSourceCodeSpecifiedByUser`
     * @param pathToRlsSpecifiedByUser A value for the field `pathToRlsSpecifiedByUser`
     */
    private constructor(
        logger: ChildLogger,
        rustInstallation: Rustup | NotRustup | undefined,
        pathToRustSourceCodeSpecifiedByUser: string | undefined,
        pathToRlsSpecifiedByUser: string | undefined
    ) {
        this.logger = logger;

        this.rustInstallation = rustInstallation;

        this.pathToRustSourceCodeSpecifiedByUser = pathToRustSourceCodeSpecifiedByUser;

        this.pathToRlsSpecifiedByUser = pathToRlsSpecifiedByUser;
    }

    private static getStringParameter(parameterName: string): string | null {
        const configuration = workspace.getConfiguration('rust');

        const parameter: string | null = configuration[parameterName];

        return parameter;
    }

    private static getPathConfigParameter(parameterName: string): string | undefined {
        const parameter = this.getStringParameter(parameterName);

        if (parameter) {
            return expandTilde(parameter);
        } else {
            return undefined;
        }
    }

    private static getPathEnvParameter(parameterName: string): string | undefined {
        const parameter = process.env[parameterName];

        if (parameter) {
            return expandTilde(parameter);
        } else {
            return undefined;
        }
    }
}
