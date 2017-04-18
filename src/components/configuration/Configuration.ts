import { SpawnOptions } from 'child_process';

import { WorkspaceConfiguration, workspace } from 'vscode';

import { RevealOutputChannelOn } from 'vscode-languageclient';

import expandTilde = require('expand-tilde');

import { OutputtingProcess } from '../../OutputtingProcess';

import { FileSystem } from '../file_system/FileSystem';

import { Rustup } from './Rustup';

import { NotRustup } from './NotRustup';

export interface RlsConfiguration {
    executable: string;

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
    private rustInstallation: Rustup | NotRustup | undefined;

    /**
     * A path to Rust's source code specified by a user.
     * It contains a value of either:
     *   - the configuration parameter `rust.rustLangSrcPath`
     *   - the environment variable `RUST_SRC_PATH`
     * The path has higher priority than a path to Rust's source code contained within an installation
     */
    private pathToRustSourceCodeSpecifiedByUser: string | undefined;

    public static async create(): Promise<Configuration> {
        const rustcSysRoot: string | undefined = await this.loadRustcSysRoot();

        const createRustInstallationPromise = async () => {
            if (!rustcSysRoot) {
                return undefined;
            }

            if (Rustup.doesManageRustcSysRoot(rustcSysRoot)) {
                return await Rustup.create(rustcSysRoot);
            } else {
                return new NotRustup(rustcSysRoot);
            }
        };

        const rustInstallation: Rustup | NotRustup | undefined = await createRustInstallationPromise();

        const pathToRustSourceCodeSpecifiedByUser = await this.checkPathToRustSourceCodeSpecifiedByUser();

        return new Configuration(rustInstallation, pathToRustSourceCodeSpecifiedByUser);
    }

    public getRlsConfiguration(): RlsConfiguration | undefined {
        const configuration = Configuration.getConfiguration();

        const rlsConfiguration: any | null = configuration['rls'];

        if (!rlsConfiguration) {
            return undefined;
        }

        const executable: string = rlsConfiguration.executable;
        const args: string[] | null = rlsConfiguration.args;
        const env: any | null = rlsConfiguration.env;
        const revealOutputChannelOn: string = rlsConfiguration.revealOutputChannelOn;

        let revealOutputChannelOnEnum: RevealOutputChannelOn;

        switch (revealOutputChannelOn) {
            case 'info':
                revealOutputChannelOnEnum = RevealOutputChannelOn.Info;
                break;

            case 'warn':
                revealOutputChannelOnEnum = RevealOutputChannelOn.Warn;
                break;

            case 'error':
                revealOutputChannelOnEnum = RevealOutputChannelOn.Error;
                break;

            case 'never':
                revealOutputChannelOnEnum = RevealOutputChannelOn.Never;
                break;

            default:
                revealOutputChannelOnEnum = RevealOutputChannelOn.Error;
        }

        return {
            executable,
            args: args !== null ? args : undefined,
            env: env !== null ? env : undefined,
            revealOutputChannelOn: revealOutputChannelOnEnum
        };
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
     * Creates a new instance of the class.
     * The constructor is private because creating a new instance should be done via the method `create`
     * @param rustInstallation A value for the field `rustInstallation`
     * @param pathToRustSourceCodeSpecifiedByUser A value for the field `pathToRustSourceCodeSpecifiedByUser`
     */
    private constructor(rustInstallation: Rustup | NotRustup | undefined, pathToRustSourceCodeSpecifiedByUser: string | undefined) {
        this.rustInstallation = rustInstallation;

        this.pathToRustSourceCodeSpecifiedByUser = pathToRustSourceCodeSpecifiedByUser;
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
