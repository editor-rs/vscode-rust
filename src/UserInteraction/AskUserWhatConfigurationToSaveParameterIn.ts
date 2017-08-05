import { window } from 'vscode';
import UserOrWorkspaceConfiguration from '../UserOrWorkspaceConfiguration';
import askUserToAnswerYesOrNo from './AskUserToAnswerYesOrNo';

/**
 * Shows the user the dialog to choose what configuration to save the parameter in
 * @return Either the choice of the user or undefined if the user dismissed the dialog
 */
export default async function askUserWhatConfigurationToSaveParameterIn(): Promise<UserOrWorkspaceConfiguration | undefined> {
    const userConfigurationChoice = 'User configuration';
    const workspaceConfigurationChoice = 'Workspace configuration';
    while (true) {
        const choice = await window.showInformationMessage(
            'What configuration do you want to save the parameter in?',
            { modal: true },
            userConfigurationChoice,
            workspaceConfigurationChoice
        );
        switch (choice) {
            case userConfigurationChoice:
                return UserOrWorkspaceConfiguration.User;
            case workspaceConfigurationChoice:
                return UserOrWorkspaceConfiguration.Workspace;
            default:
                // Ask the user if the dialog has been dismissed intentionally and that the
                // parameter shouldn't be saved. If the user doesn't confirm it, then we continue asking
                if (await askUserToConfirmCancellation()) {
                    return undefined;
                }
                break;
        }
    }
}

/**
 * Asks the user if the dialog has been dismissed intentionally
 * @return The flag indicating if the dialog has been dismissed intentionally
 */
async function askUserToConfirmCancellation(): Promise<boolean> {
    return await askUserToAnswerYesOrNo('The dialog has been dismissed. Do you want to cancel setting the configuration parameter?');
}
