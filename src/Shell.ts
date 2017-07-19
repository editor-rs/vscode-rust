/**
 * A enumeration of possible shells
 */
export enum Shell {
    PowerShell,
    Cmd,
    Shell,
    Wsl
}

/**
 * The list of all shell values
 */
export const VALUES = [Shell.PowerShell, Shell.Cmd, Shell.Shell, Shell.Wsl];

/**
 * The list of textual forms of all shell values
 */
export const VALUE_STRINGS = VALUES.map(toString);

export function fromString(s: string): Shell | undefined {
    switch (s) {
        case 'powershell':
            return Shell.PowerShell;
        case 'cmd':
            return Shell.Cmd;
        case 'shell':
            return Shell.Shell;
        case 'wsl':
            return Shell.Wsl;
        default:
            return undefined;
    }
}

/**
 * Returns the textual form of the specified shell
 * @param shell The shell to convert to string
 */
export function toString(shell: Shell): string {
    switch (shell) {
        case Shell.PowerShell:
            return 'powershell';
        case Shell.Cmd:
            return 'cmd';
        case Shell.Shell:
            return 'shell';
        case Shell.Wsl:
            return 'wsl';
    }
}
