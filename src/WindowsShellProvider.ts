import { window } from 'vscode';
import { ILogger } from './components/logging/ILogger';
import askUserWhatConfigurationToSaveParameterIn from './UserInteraction/AskUserWhatConfigurationToSaveParameterIn';
import { ConfigurationParameter } from './ConfigurationParameter';
import { IShellProvider } from './IShellProvider';
import { Shell, fromString, toString, VALUE_STRINGS } from './Shell';
import UserOrWorkspaceConfiguration from './UserOrWorkspaceConfiguration';

/**
 * The main goal of the class is to provide the current value of the shell.
 * There are three sources which the class can use to determine the current value of the shell.
 * * From the configuration parameter `rust.shell.kind.windows`
 * * From the configuration parameter `terminal.integrated.shell.windows`
 * * Asking the user to choose any of possible shell values
 */
export class WindowsShellProvider implements IShellProvider {
    private _logger: ILogger;
    private _specialConfigurationParameter: ConfigurationParameter;
    private _gettingValueFromSpecialConfigurationParameter: GettingValueFromSpecialConfigurationParameter;
    private _determiningValueFromTerminalExecutable: DeterminingValueFromTerminalExecutable;
    private _askingUserToChooseValue: AskingUserToChooseValue;

    /**
     * Creates a new object which can be used to get the current value of the shell
     * @param logger The logger which is used to create child logger which will be used to log
     * messages
     */
    public constructor(logger: ILogger) {
        this._logger = logger.createChildLogger('WindowsShellProvider: ');
        this._specialConfigurationParameter = new ConfigurationParameter('rust.shell.kind', 'windows');
        this._gettingValueFromSpecialConfigurationParameter = new GettingValueFromSpecialConfigurationParameter(this._specialConfigurationParameter);
        this._determiningValueFromTerminalExecutable = new DeterminingValueFromTerminalExecutable(
            new ConfigurationParameter('terminal.integrated.shell', 'windows')
        );
        this._askingUserToChooseValue = new AskingUserToChooseValue(logger);
    }

    /**
     * Gets the current value of the shell and returns it. This function is asynchronous because
     * it can ask the user to choose some value
     */
    public async getValue(): Promise<Shell | undefined> {
        const logger = this._logger.createChildLogger('getValue: ');
        const configValue = this._gettingValueFromSpecialConfigurationParameter.getValue();
        if (configValue !== undefined) {
            logger.debug(`configValue=${configValue}`);
            return configValue;
        }
        const determinedValue = this._determiningValueFromTerminalExecutable.determineValue();
        if (determinedValue !== undefined) {
            logger.debug(`determinedValue=${determinedValue}`);
            return determinedValue;
        }
        const userValue = await this._askingUserToChooseValue.askUser();
        if (userValue !== undefined) {
            // The user has chosen some value. We need to save it to the special configuration
            // parameter to avoid asking the user in the future
            logger.debug(`userValue=${toString(userValue)}`);
            await this.trySaveUserValueToConfiguration(userValue);
            return userValue;
        }
        return undefined;
    }

    /**
     * Asks the user what configuration to save the value in and if the user chooses any, saves it
     * to the chosen configuration
     * @param userValue The value chosen by the user
     */
    private async trySaveUserValueToConfiguration(userValue: Shell): Promise<void> {
        const chosenConfiguration = await askUserWhatConfigurationToSaveParameterIn();
        if (chosenConfiguration !== undefined) {
            this._specialConfigurationParameter.setValue(toString(userValue), chosenConfiguration === UserOrWorkspaceConfiguration.User);
        }
    }
}

/**
 * The main goal of the class is to provide the current value of the shell from the configuration
 * parameter `rust.shell.kind.*`
 */
class GettingValueFromSpecialConfigurationParameter {
    private _parameter: ConfigurationParameter;

    /**
     * Creates a new object which can be used to get the current value of the shell
     * @param parameter The configuration parameter
     */
    public constructor(parameter: ConfigurationParameter) {
        this._parameter = parameter;
    }

    /**
     * Gets the current value of the shell from the configuration parameter and returns it
     * @return if the configuration parameter contains some valid value, the value, `undefined`
     * otherwise
     */
    public getValue(): Shell | undefined {
        const kind = this._parameter.getValue();
        if (typeof kind === 'string') {
            return fromString(kind);
        }
        return undefined;
    }
}

/**
 * The main goal of the class is to provide the current value of the shell which is determined
 * from the configuration parameter `terminal.integrated.shell.*`
 */
class DeterminingValueFromTerminalExecutable {
    private _parameter: ConfigurationParameter;

    /**
     * Creates a new object which can be to get the current value of the shell
     * @param parameter The configuration parameter
     */
    public constructor(parameter: ConfigurationParameter) {
        this._parameter = parameter;
    }

    /**
     * Determines the current value of the shell and returns it
     * @return if some value is determined, the value, `undefined` otherwise
     */
    public determineValue(): Shell | undefined {
        const shellPath = this._parameter.getValue();
        const defaultValue = undefined;
        if (!shellPath) {
            return defaultValue;
        }
        if (shellPath.includes('powershell')) {
            return Shell.PowerShell;
        }
        if (shellPath.includes('cmd')) {
            return Shell.Cmd;
        }
        return defaultValue;
    }
}

/**
 * The main goal of the class is to ask the user to choose some shell
 */
class AskingUserToChooseValue {
    private _logger: ILogger;

    /**
     * Creates a new object which can be used to ask the user to choose some shell
     * @param logger The logger to log messages
     */
    public constructor(logger: ILogger) {
        this._logger = logger;
    }

    public async askUser(): Promise<Shell | undefined> {
        const logger = this._logger.createChildLogger('askUser: ');
        await window.showInformationMessage('In order to run a command in the integrated terminal, the kind of shell should be chosen');
        const choice = await window.showQuickPick(VALUE_STRINGS);
        if (!choice) {
            logger.debug('the user has dismissed the quick pick');
            return undefined;
        }
        const shell = fromString(choice);
        if (shell === undefined) {
            logger.debug(`the user has chosen some impossible value; choice=${choice}`);
            return undefined;
        }
        return shell;
    }
}
