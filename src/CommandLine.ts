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
        return `export ${varName}=${varValue}`;
    }
}
