import { MessageItem, window } from 'vscode';

/**
 * Shows the user the dialog with the specified message and two choices: Yes or No
 * @param message The message to show to the user
 * @return The flag indicating whether the Yes choice has been chosen
 */
export default async function askUserToAnswerYesOrNo(message: string): Promise<boolean> {
    const yesChoice: MessageItem = { title: 'Yes' };
    const noChoice: MessageItem = { title: 'No', isCloseAffordance: true };
    const choice = await window.showInformationMessage(message, { modal: true }, yesChoice, noChoice);
    return choice === yesChoice;
}
