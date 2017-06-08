export class Toolchain {
    public static readonly defaultToolchainPrefix: string = ' (default)';

    /**
     * "stable" in "stable-x86_64-pc-windows-msvc (default)"
     */
    public readonly channel: string;

    /**
     * "x86_64-pc-windows-msvc" in "stable-x86_64-pc-windows-msvc (default)"
     * `undefined` in "stable"
     */
    public readonly host: string | undefined;

    /**
     * true in "stable-x86_64-pc-windows-msvc (default)".
     * false in "stable-x86_64-pc-windows-msvc"
     */
    public readonly isDefault: boolean;

    /**
     * Tries to parse the text and if returns the toolchain parsed from the text
     * @param text The text to parse
     * @return the toolchain or undefined
     */
    public static parse(text: string): Toolchain | undefined {
        const sepIndex = text.indexOf('-');
        const channelEnd = sepIndex === -1 ? undefined : sepIndex;
        const channel = text.substring(0, channelEnd);
        if (channelEnd === undefined) {
            // The text represents the toolchain with the only channel.
            return new Toolchain(channel, undefined, false);
        }
        const spaceIndex = text.indexOf(' ', sepIndex);
        const hostEnd = spaceIndex === -1 ? undefined : spaceIndex;
        const host = text.substring(sepIndex + 1, hostEnd);
        const isDefault = text.endsWith(Toolchain.defaultToolchainPrefix);
        return new Toolchain(channel, host, isDefault);
    }

    public equals(toolchain: Toolchain): boolean {
        return this.channel === toolchain.channel && this.host === toolchain.host;
    }

    public toString(includeHost: boolean, includeIsDefault: boolean): string {
        let s = this.channel.concat();
        if (includeHost && this.host) {
            s += '-';
            s += this.host;
        }
        if (includeIsDefault && this.isDefault) {
            s += Toolchain.defaultToolchainPrefix;
        }
        return s;
    }

    private constructor(channel: string, host: string | undefined, isDefault: boolean) {
        this.channel = channel;
        this.host = host;
        this.isDefault = isDefault;
    }
}
