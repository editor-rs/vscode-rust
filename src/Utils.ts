/**
 * Surrounds the specified string by double quotes (").
 * Does nothing if the string is already surrounded by them
 * @param s The string to surround by double quotes
 * @return The string surrounded by double quotes
 */
export function surround_by_double_quotes(s: string): string {
    if (!s.startsWith('"')) {
        s = '"'.concat(s);
    }
    if (!s.endsWith('"')) {
        s = s.concat('"');
    }
    return s;
}
