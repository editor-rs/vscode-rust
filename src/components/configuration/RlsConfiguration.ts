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
        if (this._rustup && this._rustup.isRlsInstalled()) {
            return ['run', 'nightly', 'rls'].concat(this._userArgs);
        } else {
            return this._userArgs;
        }
    }

    /**
     * Returns environment to run RLS in
     */
    public getEnv(): object {
        const env = Object.create(this._userEnv);
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

    private constructor(rustup: Rustup | undefined, rustSource: RustSource, executableUserPath: string | undefined) {
        this._rustup = rustup;
        this._rustSource = rustSource;
        this._executableUserPath = executableUserPath;
        this._userArgs = getUserArgs();
        this._userEnv = getUserEnv();
        this._revealOutputChannelOn = getUserRevealOutputChannelOn();
    }
}

function getUserConfiguration(): any {
    return Configuration.getConfiguration()['rls'];
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
    if (!configuration) {
        return RevealOutputChannelOn.Error;
    }
    switch (configuration.revealOutputChannelOn) {
        case 'info':
            return RevealOutputChannelOn.Info;
        case 'warn':
            return RevealOutputChannelOn.Warn;
        case 'error':
            return RevealOutputChannelOn.Error;
        case 'never':
        default:
            return RevealOutputChannelOn.Error;
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
