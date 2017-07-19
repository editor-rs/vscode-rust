import { Shell } from './Shell';
import { correctPath } from './WslShellUtils';

/**
 * Creates a command to set the environment variable
 * @param shell The shell which the command is going to be passed to
 * @param varName The variable's name
 * @param varValue The variable's value
 * @return A created command which if it is passed to a terminal,
 * it will set the environment variable
 */
export function getCommandToSetEnvVar(shell: Shell, varName: string, varValue: string): string {
    switch (shell) {
        case Shell.PowerShell:
            return `$ENV:${varName}="${varValue}"`;
        case Shell.Cmd:
            return `set ${varName}=${varValue}`;
        case Shell.Shell:
        case Shell.Wsl:
            return ` export ${varName}=${varValue}`;
    }
}

/**
 * Escapes spaces in the specified string in the way appropriate to the specified shell
 * @param s The string to escape spaces in
 * @param shell The shell in which the string should be used
 * @return The string after escaping spaces
 */
export function escapeSpaces(s: string, shell: Shell): string {
    if (!s.includes(' ')) {
        return s;
    }
    switch (shell) {
        case Shell.PowerShell:
            // Unescape
            s = s.replace(new RegExp('` ', 'g'), ' ');
            // Escape
            return s.replace(new RegExp(' ', 'g'), '` ');
        case Shell.Cmd:
            s = s.concat();
            if (!s.startsWith('"')) {
                s = '"'.concat(s);
            }
            if (!s.endsWith('"')) {
                s = s.concat('"');
            }
            return s;
        case Shell.Shell:
        case Shell.Wsl:
            s = s.concat();
            if (!s.startsWith('\'')) {
                s = '\''.concat(s);
            }
            if (!s.endsWith('\'')) {
                s = s.concat('\'');
            }
            return s;
    }
}

export function getCommandToChangeWorkingDirectory(
    shell: Shell,
    workingDirectory: string
): string {
    if (shell === Shell.Wsl) {
        workingDirectory = correctPath(workingDirectory);
    }
    return getCommandForArgs(shell, ['cd', workingDirectory]);
}

/**
 * Prepares the specified arguments to be passed to the specified shell and constructs the command
 * from the arguments
 * @param shell The shell in which the command will be executed
 * @param args The arguments to prepare and construct the command from
 * @return The command which is constructed from the specified arguments
 */
export function getCommandForArgs(shell: Shell, args: string[]): string {
    args = args.map(a => escapeSpaces(a, shell));
    return args.join(' ');
}

/**
 * Creates a command to execute several statements one by one if the previous one is succeed
 * @param shell The shell which the command is going to be passed to
 * @param statements The statements to execute
 * @return A created command which if it is passed to a terminal,
 * it will execute the statements
 */
export function getCommandToExecuteStatementsOneByOneIfPreviousIsSucceed(
    shell: Shell,
    statements: string[]
): string {
    if (statements.length === 0) {
        return '';
    }
    if (shell === Shell.PowerShell) {
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
