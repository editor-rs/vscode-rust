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

    public async setValue(value: any): Promise<void> {
        await this.getConfiguration().update(this._parameterName, value, true);
    }

    private getConfiguration(): WorkspaceConfiguration {
        return workspace.getConfiguration('');
    }
}
