import { WorkspaceConfiguration, workspace } from 'vscode';
import expandTilde = require('expand-tilde');
import { FileSystem } from '../file_system/FileSystem';
import { ChildLogger } from '../logging/child_logger';

export enum ActionOnStartingCommandIfThereIsRunningCommand {
    StopRunningCommand,
    IgnoreNewCommand,
    ShowDialogToLetUserDecide
}

export enum Mode {
    Legacy,
    RLS
}

/**
 * Returns the representation of the specified mode suitable for being a value for the
 * configuration parameter
 * @param mode The mode which representation will be returned for
 * @return The representation of the specified mode
 */
export function asConfigurationParameterValue(mode: Mode | undefined): string | null {
    switch (mode) {
        case Mode.Legacy:
            return 'legacy';
        case Mode.RLS:
            return 'rls';
        case undefined:
            return null;
    }
}

namespace Properties {
    export const mode = 'mode';
}

/**
 * The main class of the component `Configuration`.
 * This class contains code related to Configuration
 */
export class Configuration {
    private _mode: Mode | undefined;
    private logger: ChildLogger;

    /**
     * A path to the executable of racer.
     * It contains a value of either:
     *   - the configuration parameter `rust.racerPath`
     *   - a path found in any of directories specified in the envirionment variable PATH
     * The configuration parameter has higher priority than automatically found path
     */
    private racerPath: string | undefined;

    public static getConfiguration(): WorkspaceConfiguration {
        const configuration = workspace.getConfiguration('rust');

        return configuration;
    }

    public static getPathConfigParameter(parameterName: string): string | undefined {
        const parameter = this.getStringConfigParameter(parameterName);
        if (parameter) {
            return expandTilde(parameter);
        } else {
            return undefined;
        }
    }

    public static getPathEnvParameter(parameterName: string): string | undefined {
        const parameter = process.env[parameterName];
        if (parameter) {
            return expandTilde(parameter);
        } else {
            return undefined;
        }
    }

    public static getStringConfigParameter(parameterName: string): string | undefined {
        const configuration = workspace.getConfiguration('rust');
        const parameter = configuration.get<string>(parameterName);
        return parameter;
    }

    /**
     * Creates a new instance of the class.
     * @param logger A value for the field `logger`
     */
    public constructor(logger: ChildLogger) {
        function mode(): Mode | undefined {
            const configuration = Configuration.getConfiguration();
            const value: string | null | undefined = configuration[Properties.mode];
            if (typeof value === 'string') {
                switch (value) {
                    case asConfigurationParameterValue(Mode.Legacy):
                        return Mode.Legacy;
                    case asConfigurationParameterValue(Mode.RLS):
                        return Mode.RLS;
                    default:
                        return undefined;
                }
            } else {
                return undefined;
            }
        }
        this._mode = mode();
        this.logger = logger;
        this.racerPath = undefined;
    }

    /**
     * Updates the value of the field `pathToRacer`.
     * It checks if a user specified any path in the configuration.
     * If no path specified or a specified path can't be used, it finds in directories specified in the environment variable PATH.
     * This method is asynchronous because it checks if a path exists before setting it to the field
     */
    public async updatePathToRacer(): Promise<void> {
        async function findRacerPathSpecifiedByUser(logger: ChildLogger): Promise<string | undefined> {
            const methodLogger = logger.createChildLogger('findRacerPathSpecifiedByUser: ');
            let path: string | undefined | null = Configuration.getPathConfigParameter('racerPath');
            if (!path) {
                methodLogger.debug(`path=${path}`);
                return undefined;
            }
            path = expandTilde(path);
            methodLogger.debug(`path=${path}`);
            const foundPath: string | undefined = await FileSystem.findExecutablePath(path);
            methodLogger.debug(`foundPath=${foundPath}`);
            return foundPath;
        }
        async function findDefaultRacerPath(logger: ChildLogger): Promise<string | undefined> {
            const methodLogger = logger.createChildLogger('findDefaultRacerPath: ');
            const foundPath: string | undefined = await FileSystem.findExecutablePath('racer');
            methodLogger.debug(`foundPath=${foundPath}`);
            return foundPath;
        }
        const logger = this.logger.createChildLogger('updatePathToRacer: ');
        this.racerPath = (
            await findRacerPathSpecifiedByUser(logger) ||
            await findDefaultRacerPath(logger)
        );
    }

    /**
     * Returns the mode which the extension runs in
     * @return The mode
     */
    public mode(): Mode | undefined {
        return this._mode;
    }

    /**
     * Saves the specified mode in both the object and the configuration
     * @param mode The mode
     */
    public setMode(mode: Mode | undefined): void {
        this._mode = mode;
        const configuration = Configuration.getConfiguration();
        configuration.update(Properties.mode, asConfigurationParameterValue(mode), true);
    }

    /**
     * Returns a value of the field `pathToRacer`
     */
    public getPathToRacer(): string | undefined {
        return this.racerPath;
    }

    public shouldExecuteCargoCommandInTerminal(): boolean {
        // When RLS is used any cargo command is executed in an integrated terminal.
        if (this.mode() === Mode.RLS) {
            return true;
        }
        const configuration = Configuration.getConfiguration();
        const shouldExecuteCargoCommandInTerminal = configuration['executeCargoCommandInTerminal'];
        return shouldExecuteCargoCommandInTerminal;
    }

    public getActionOnSave(): string | undefined {
        return Configuration.getStringConfigParameter('actionOnSave');
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

    public getRustfmtPath(): string {
        const rustfmtPath = Configuration.getPathConfigParameter('rustfmtPath');

        return rustfmtPath || 'rustfmt';
    }

    public getRustsymPath(): string {
        const rustsymPath = Configuration.getPathConfigParameter('rustsymPath');

        return rustsymPath || 'rustsym';
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
}
