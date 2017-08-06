import { WorkspaceConfiguration, workspace } from 'vscode';

/**
 * The main goal of the class is to store the parameter's name and to expose functions to get/set
 * the value of the parameter
 */
export class ConfigurationParameter {
    private _sectionName: string;
    private _parameterName: string;

    public constructor(sectionName: string, parameterName: string) {
        this._sectionName = sectionName;
        this._parameterName = parameterName;
    }

    public getValue(): any {
        return this.getConfiguration().get(this._parameterName);
    }

    /**
     * Sets the value in either the user configuration or the workspace configuration
     * @param value The value to set
     * @param setToUserConfiguration The flag indicating if the value has to be set to the user settings instead
     * of the workspace settings
     */
    public async setValue(value: any, setToUserConfiguration: boolean): Promise<void> {
        // The configuration doesn't support `undefined`. We must convert it to `null`
        const convertedValue = value === undefined ? null : value;
        await this.getConfiguration().update(
            this._parameterName,
            convertedValue,
            setToUserConfiguration
        );
    }

    private getConfiguration(): WorkspaceConfiguration {
        return workspace.getConfiguration(this._sectionName);
    }
}
