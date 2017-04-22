/**
 * Creates a command to set the environment variable
 * @param shell The shell which the command is going to be passed to
 * @param varName The variable's name
 * @param varValue The variable's value
 * @return A created command which if it is passed to a terminal,
 * it will set the environment variable
 */
export function getCommandToSetEnvVar(shell: string, varName: string, varValue: string): string {
    const isWindows = process.platform === 'win32';

    if (!isWindows) {
        return `export ${varName}=${varValue}`;
    }

    if (shell.includes('powershell')) {
        return `$ENV:${varName}="${varValue}"`;
    } else if (shell.includes('cmd')) {
        return `set ${varName}=${varValue}`;
    } else {
        // The string starts with space to make sh not save the command
        return ` export ${varName}=${varValue}`;
    }
}

/**
 * Creates a command to execute several statements one by one if the previous one is succeed
 * @param shell The shell which the command is going to be passed to
 * @param statements The statements to execute
 * @return A created command which if it is passed to a terminal,
 * it will execute the statements
 */
export function getCommandToExecuteStatementsOneByOneIfPreviousIsSucceed(shell: string, statements: string[]): string {
    if (statements.length === 0) {
        return '';
    }

    if (process.platform === 'win32' && shell.includes('powershell')) {
        let command = statements[0];

        for (let i = 1; i < statements.length; ++i) {
            command += `; if ($?) { ${statements[i]}; }`;
        }

        return command;
    } else {
        // The string starts with space to make sh not save the command.
        // This code is also executed for cmd on Windows, but leading space doesn't break anything
        let command = ' ' + statements[0];

        for (let i = 1; i < statements.length; ++i) {
            command += ` && ${statements[i]}`;
        }

        return command;
    }
}
