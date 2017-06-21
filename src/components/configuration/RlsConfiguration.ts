import expandTilde = require('expand-tilde');
import { RevealOutputChannelOn } from 'vscode-languageclient';
import { FileSystem } from '../file_system/FileSystem';
import { Configuration } from './Configuration';
import { Rustup } from './Rustup';
import { RustSource } from './RustSource';

/**
 * This class provides functionality related to RLS configuration
 */
export class RlsConfiguration {
    private _rustup: Rustup | undefined;
    private _rustSource: RustSource;
    private _executableUserPath: string | undefined;
    private _userArgs: string[];
    private _userEnv: object;
    private _revealOutputChannelOn: RevealOutputChannelOn;
    private _useRustfmt: boolean | undefined;

    /**
     * Creates a new instance of the class
     * @param rustup The rustup object
     * @param rustSource The rust's source object
     */
    public static async create(rustup: Rustup | undefined, rustSource: RustSource): Promise<RlsConfiguration> {
        const executableUserPath = await getCheckedExecutableUserPath();
        return new RlsConfiguration(rustup, rustSource, executableUserPath);
    }

    /**
     * Returns a path to RLS executable
     */
    public getExecutablePath(): string | undefined {
        if (this._executableUserPath) {
            return this._executableUserPath;
        }
        if (this._rustup && this._rustup.isRlsInstalled()) {
            return 'rustup';
        }
        return undefined;
    }

    /**
     * Returns arguments for RLS
     */
    public getArgs(): string[] {
        // When the user specifies some executable path, the user expects the extension not to add
        // some arguments
        if (this._executableUserPath === undefined && this._rustup && this._rustup.isRlsInstalled()) {
            return ['run', 'nightly', 'rls'].concat(this._userArgs);
        } else {
            return this._userArgs;
        }
    }

    /**
     * Returns environment to run RLS in
     */
    public getEnv(): object {
        const env: any = Object.assign({}, this._userEnv);
        if (!env.RUST_SRC_PATH) {
            const rustSourcePath = this._rustSource.getPath();
            if (rustSourcePath) {
                env.RUST_SRC_PATH = rustSourcePath;
            }
        }
        return env;
    }

    /**
     * Returns how the output channel of RLS should behave when receiving messages
     */
    public getRevealOutputChannelOn(): RevealOutputChannelOn {
        return this._revealOutputChannelOn;
    }

    /**
     * Returns whether rustfmt should be used for formatting
     */
    public getUseRustfmt(): boolean | undefined {
        return this._useRustfmt;
    }

    /**
     * Updates the property "useRustfmt" in the user configuration
     * @param value The new value
     */
    public setUseRustfmt(value: boolean | undefined): void {
        if (this._useRustfmt === value) {
            return;
        }
        this._useRustfmt = value;
        const suitableValue = typeof value === 'boolean' ? value : null;
        updateUserConfigurationParameter(c => { c.useRustfmt = suitableValue; });
    }

    private constructor(rustup: Rustup | undefined, rustSource: RustSource, executableUserPath: string | undefined) {
        this._rustup = rustup;
        this._rustSource = rustSource;
        this._executableUserPath = executableUserPath;
        this._userArgs = getUserArgs();
        this._userEnv = getUserEnv();
        this._revealOutputChannelOn = getUserRevealOutputChannelOn();
        this._useRustfmt = getUserUseRustfmt();
    }
}

function getUserConfiguration(): any {
    return Configuration.getConfiguration()['rls'];
}

function updateUserConfigurationParameter(updateParameter: (c: any) => void): void {
    let configuration = getUserConfiguration();
    if (!configuration) {
        configuration = {};
    }
    updateParameter(configuration);
    Configuration.getConfiguration().update('rls', configuration, true);
}

function getExecutableUserPath(): string | undefined {
    const configuration = getUserConfiguration();
    if (!configuration) {
        return configuration;
    }
    const path = configuration.executable;
    // This condition will evaluate to `true` if `path` is `null`, `undefined` or an empty string and in that case it is possible to return just `undefined`
    if (!path) {
        return undefined;
    }
    return path;
}

function getUserArgs(): string[] {
    const configuration = getUserConfiguration();
    if (!configuration) {
        return [];
    }
    const args = configuration.args;
    if (!args) {
        return [];
    }
    return args;
}

function getUserEnv(): object {
    const configuration = getUserConfiguration();
    if (!configuration) {
        return {};
    }
    const env = configuration.env;
    if (!env) {
        return {};
    }
    return env;
}

function getUserRevealOutputChannelOn(): RevealOutputChannelOn {
    const configuration = getUserConfiguration();
    const value = configuration ? configuration.revealOutputChannelOn : undefined;
    switch (value) {
        case 'info':
            return RevealOutputChannelOn.Info;
        case 'warn':
            return RevealOutputChannelOn.Warn;
        case 'error':
            return RevealOutputChannelOn.Error;
        case 'never':
            return RevealOutputChannelOn.Never;
        default:
            return RevealOutputChannelOn.Error;
    }
}

function getUserUseRustfmt(): boolean | undefined {
    const configuration = getUserConfiguration();
    if (!configuration) {
        return undefined;
    }
    const useRustfmt = configuration.useRustfmt;
    if (typeof useRustfmt === 'boolean') {
        return useRustfmt;
    } else {
        return undefined;
    }
}

async function getCheckedExecutableUserPath(): Promise<string | undefined> {
    const path = getExecutableUserPath();
    if (!path) {
        return undefined;
    }
    const tildeExpandedPath = expandTilde(path);
    const foundPath = await FileSystem.findExecutablePath(tildeExpandedPath);
    return foundPath;
}
