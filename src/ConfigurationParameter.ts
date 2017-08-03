import { WorkspaceConfiguration, workspace } from 'vscode';

/**
 * The main goal of the class is to store the parameter's name and to expose functions to get/set
 * the value of the parameter
 */
export class ConfigurationParameter {
    private _parameterName: string;

    public constructor(parameterName: string) {
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
        await this.getConfiguration().update(this._parameterName, value, setToUserConfiguration);
    }

    private getConfiguration(): WorkspaceConfiguration {
        return workspace.getConfiguration('');
    }
}
