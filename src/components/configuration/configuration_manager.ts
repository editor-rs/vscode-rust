import { SpawnOptions, spawn } from 'child_process';

import { access } from 'fs';

import { join } from 'path';

import { WorkspaceConfiguration, workspace } from 'vscode';

import expandTilde = require('expand-tilde');

export interface RlsConfiguration {
    executable: string;

    args?: string[];

    env?: any;
}

export enum ActionOnStartingCommandIfThereIsRunningCommand {
    Stop,
    Dialog
}

export class ConfigurationManager {
    private rustcSysRoot: string | undefined;

    private rustSourcePath: string | undefined;

    public static async create(): Promise<ConfigurationManager> {
        const rustcSysRoot = await this.loadRustcSysRoot();

        const rustSourcePath = await this.loadRustSourcePath(rustcSysRoot);

        return new ConfigurationManager(rustcSysRoot, rustSourcePath);
    }

    public getRlsConfiguration(): RlsConfiguration | null {
        const configuration = ConfigurationManager.getConfiguration();

        const rlsConfiguration: RlsConfiguration | null = configuration['rls'];

        return rlsConfiguration;
    }

    public shouldExecuteCargoCommandInTerminal(): boolean {
        // When RLS is used any cargo command is executed in an integrated terminal.
        if (this.getRlsConfiguration()) {
            return true;
        }

        const configuration = ConfigurationManager.getConfiguration();

        const shouldExecuteCargoCommandInTerminal = configuration['executeCargoCommandInTerminal'];

        return shouldExecuteCargoCommandInTerminal;
    }

    public getActionOnSave(): string | null {
        const actionOnSave = ConfigurationManager.getStringParameter('actionOnSave');

        return actionOnSave;
    }

    public getRustcSysRoot(): string {
        return this.rustcSysRoot;
    }

    public shouldShowRunningCargoTaskOutputChannel(): boolean {
        const configuration = ConfigurationManager.getConfiguration();

        const shouldShowRunningCargoTaskOutputChannel = configuration['showOutput'];

        return shouldShowRunningCargoTaskOutputChannel;
    }

    public getCargoEnv(): any {
        const configuration = ConfigurationManager.getConfiguration();

        const cargoEnv = configuration['cargoEnv'];

        return cargoEnv || {};
    }

    public getCargoPath(): string {
        const rustsymPath = ConfigurationManager.getPathConfigParameter('cargoPath');

        return rustsymPath || 'cargo';
    }

    public getCargoHomePath(): string | undefined {
        const configPath = ConfigurationManager.getPathConfigParameter('cargoHomePath');

        const envPath = ConfigurationManager.getPathEnvParameter('CARGO_HOME');

        return configPath || envPath || undefined;
    }

    public getRacerPath(): string {
        const racerPath = ConfigurationManager.getPathConfigParameter('racerPath');

        return racerPath || 'racer';
    }

    public getRustfmtPath(): string {
        const rustfmtPath = ConfigurationManager.getPathConfigParameter('rustfmtPath');

        return rustfmtPath || 'rustfmt';
    }

    public getRustsymPath(): string {
        const rustsymPath = ConfigurationManager.getPathConfigParameter('rustsymPath');

        return rustsymPath || 'rustsym';
    }

    public getRustSourcePath(): string | undefined {
        return this.rustSourcePath;
    }

    public getActionOnStartingCommandIfThereIsRunningCommand():
        ActionOnStartingCommandIfThereIsRunningCommand | undefined {
        const configuration = ConfigurationManager.getConfiguration();

        const action = configuration['actionOnStartingCommandIfThereIsRunningCommand'];

        switch (action) {
            case 'stop':
                return ActionOnStartingCommandIfThereIsRunningCommand.Stop;

            case 'dialog':
                return ActionOnStartingCommandIfThereIsRunningCommand.Dialog;

            default:
                return undefined;
        }
    }

    public static getConfiguration(): WorkspaceConfiguration {
        const configuration = workspace.getConfiguration('rust');

        return configuration;
    }

    private static async loadRustcSysRoot(): Promise<string | undefined> {
        const args = ['--print', 'sysroot'];

        const options: SpawnOptions = { cwd: process.cwd() };

        const spawnedProcess = spawn('rustc', args, options);

        return new Promise<string | undefined>(resolve => {
            spawnedProcess.on('error', () => {
                resolve(undefined);
            });
            spawnedProcess.on('exit', code => {
                if (code === 0) {
                    const sysroot = spawnedProcess.stdout.read().toString().trim();

                    resolve(sysroot);
                } else {
                    resolve(undefined);
                }
            });
        });
    }

    /**
     * Loads the path of the Rust's source code.
     * It tries to load from different places.
     * These places sorted by priority (the first item has the highest priority):
     * * User/Workspace configuration
     * * Environment
     * * Rustup
     */
    private static async loadRustSourcePath(rustcSysRoot: string | undefined): Promise<string | undefined> {
        const configPath = this.getPathConfigParameter('rustLangSrcPath');

        const configPathExists = await this.checkPathExists(configPath);

        if (configPathExists) {
            return configPath;
        }

        const envPath = this.getPathEnvParameter('RUST_SRC_PATH');

        const envPathExists = await this.checkPathExists(envPath);

        if (envPathExists) {
            return envPath;
        }

        if (!rustcSysRoot.includes('.rustup')) {
            return undefined;
        }

        const rustupPath = join(rustcSysRoot, 'lib', 'rustlib', 'src', 'rust', 'src');

        const rustupPathExists = this.checkPathExists(rustupPath);

        if (rustupPathExists) {
            return rustupPath;
        } else {
            return undefined;
        }
    }

    private static checkPathExists(path: string | undefined): Promise<boolean> {
        if (!path) {
            return Promise.resolve(false);
        }

        return new Promise<boolean>(resolve => {
            access(path, err => {
                const pathExists = !err;

                resolve(pathExists);
            });
        });
    }

    private constructor(rustcSysRoot: string | undefined, rustSourcePath: string | undefined) {
        this.rustcSysRoot = rustcSysRoot;

        this.rustSourcePath = rustSourcePath;
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
