export enum Shell {
    PowerShell,
    CMD,
    Shell
}

/**
 * Parses the specified string as a variant of the enum `Shell`.
 * If it fails to match the string, it returns `Shell.Shell`
 * @param shell The shell textual representation
 * @return The shell matching the specified string
 */
export function parseShell(shell: string): Shell {
    if (shell.includes('powershell')) {
        return Shell.PowerShell;
    }
    if (shell.includes('cmd')) {
        return Shell.CMD;
    }
    return Shell.Shell;
}

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
        case Shell.CMD:
            return `set ${varName}=${varValue}`;
        case Shell.Shell:
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
        case Shell.CMD:
            s = s.concat();
            if (!s.startsWith('"')) {
                s = '"'.concat(s);
            }
            if (!s.endsWith('"')) {
                s = s.concat('"');
            }
            return s;
        case Shell.Shell:
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

/**
 * Creates a command to execute several statements one by one if the previous one is succeed
 * @param shell The shell which the command is going to be passed to
 * @param statements The statements to execute
 * @return A created command which if it is passed to a terminal,
 * it will execute the statements
 */
export function getCommandToExecuteStatementsOneByOneIfPreviousIsSucceed(shell: Shell, statements: string[]): string {
    if (statements.length === 0) {
        return '';
    }

    if (process.platform === 'win32' && shell === Shell.PowerShell) {
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
