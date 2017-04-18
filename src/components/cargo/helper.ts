import { window } from 'vscode';

import {
    ActionOnStartingCommandIfThereIsRunningCommand,
    Configuration
} from '../configuration/Configuration';

export enum CommandStartHandleResult {
    StopRunningCommand,
    IgnoreNewCommand
}

/**
 * The class stores functionality which can't be placed somewhere else.
 */
export class Helper {
    private configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public handleCommandStartWhenThereIsRunningCommand(): Promise<CommandStartHandleResult> {
        const action =
            this.configuration.getActionOnStartingCommandIfThereIsRunningCommand();

        switch (action) {
            case ActionOnStartingCommandIfThereIsRunningCommand.ShowDialogToLetUserDecide:
                return new Promise(async (resolve) => {
                    const choice = await window.showInformationMessage(
                        'You requested to start a command, but there is another running command',
                        'Terminate'
                    );

                    if (choice === 'Terminate') {
                        resolve(CommandStartHandleResult.StopRunningCommand);
                    } else {
                        resolve(CommandStartHandleResult.IgnoreNewCommand);
                    }
                });

            case ActionOnStartingCommandIfThereIsRunningCommand.StopRunningCommand:
                return Promise.resolve(CommandStartHandleResult.StopRunningCommand);

            case ActionOnStartingCommandIfThereIsRunningCommand.IgnoreNewCommand:
                return Promise.resolve(CommandStartHandleResult.IgnoreNewCommand);
        }
    }
}
