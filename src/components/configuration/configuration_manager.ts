import { SpawnOptions, spawn } from 'child_process';

import { ExtensionContext, WorkspaceConfiguration, workspace } from 'vscode';

import expandTilde = require('expand-tilde');

export interface RlsConfiguration {
    executable: string;

    args?: string[];

    env?: any;
}

export default class ConfigurationManager {
    public constructor(context: ExtensionContext) {
        context.subscriptions.push(
            workspace.onDidChangeConfiguration(() => {
                this.updateRustLangSrcInEnvironmentIfRequired();
            })
        );
    }

    public getRlsConfiguration(): RlsConfiguration | null {
        const configuration = this.getConfiguration();

        const rlsConfiguration: RlsConfiguration | null = configuration['rls'];

        return rlsConfiguration;
    }

    public getActionOnSave(): string | null {
        const actionOnSave = this.getStringParameter('actionOnSave');

        return actionOnSave;
    }

    public getRustcSysroot(): Promise<string> {
        const args = ['--print', 'sysroot'];
        
        const options: SpawnOptions = { cwd: process.cwd() };

        const spawnedProcess = spawn('rustc', args, options);

        return new Promise((resolve, reject) => {
            spawnedProcess.on('error', () => {
                reject();
            });
            spawnedProcess.on('exit', code => {
                if (code === 0) {
                    const sysroot = spawnedProcess.stdout.read().toString().trim();

                    resolve(sysroot);
                } else {
                    reject();
                }
            });
        });
    }

    public shouldShowRunningCargoTaskOutputChannel(): boolean {
        const configuration = this.getConfiguration();

        const shouldShowRunningCargoTaskOutputChannel = configuration['showOutput'];

        return shouldShowRunningCargoTaskOutputChannel;
    }

    public isFormatOnSaveEnabled(): boolean {
        const configuration = this.getConfiguration();

        const isFormatOnSaveEnabled = configuration['formatOnSave'];

        return isFormatOnSaveEnabled;
    }

    public getCargoEnv(): any {
        const configuration = this.getConfiguration();

        const cargoEnv = configuration['cargoEnv'];

        return cargoEnv || {};
    }

    public getCargoPath(): string {
        const rustsymPath = this.getPathParameter('cargoPath');

        return rustsymPath || 'cargo';
    }

    public getCargoHomePath(): string {
        const cargoHomePath = this.getPathParameter('cargoHomePath');

        return cargoHomePath || process.env['CARGO_HOME'] || '';
    }

    public getRacerPath(): string {
        const racerPath = this.getPathParameter('racerPath');

        return racerPath || 'racer';
    }

    public getRustfmtPath(): string {
        const rustfmtPath = this.getPathParameter('rustfmtPath');

        return rustfmtPath || 'rustfmt';
    }

    public getRustsymPath(): string {
        const rustsymPath = this.getPathParameter('rustsymPath');

        return rustsymPath || 'rustsym';
    }

    public getRustLangSrcPath(): string {
        const rustLangSrcPath = this.getPathParameter('rustLangSrcPath');

        return rustLangSrcPath || '';
    }

    public getConfiguration(): WorkspaceConfiguration {
        const configuration = workspace.getConfiguration('rust');

        return configuration;
    }

    public getStringParameter(parameterName: string): string | null {
        const configuration = workspace.getConfiguration('rust');

        const parameter: string | null = configuration[parameterName];

        return parameter;
    }

    public getPathParameter(parameterName: string): string | null {
        const parameter = this.getStringParameter(parameterName);

        if (parameter) {
            return expandTilde(parameter);
        } else {
            return null;
        }
    }

    private updateRustLangSrcInEnvironmentIfRequired(): void {
        const rustLangSrcPath = this.getRustLangSrcPath();

        if (process.env['RUST_SRC_PATH'] !== rustLangSrcPath) {
            process.env['RUST_SRC_PATH'] = rustLangSrcPath;
        }
    }
}
