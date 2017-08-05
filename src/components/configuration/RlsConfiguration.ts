import expandTilde = require('expand-tilde');
import { RevealOutputChannelOn as RevealOutputChannelOnEnum } from 'vscode-languageclient';
import { ConfigurationParameter } from '../../ConfigurationParameter';
import { FileSystem } from '../file_system/FileSystem';
import { Rustup } from './Rustup';
import { RustSource } from './RustSource';

/**
 * This class provides functionality related to RLS configuration
 */
export class RlsConfiguration {
    private _useRustfmtConfigurationParameter: ConfigurationParameters.UseRustfmt;
    private _rustup: Rustup | undefined;
    private _rustSource: RustSource;
    private _executableUserPath: string | undefined;
    private _userArgs: string[];
    private _userEnv: object;
    private _revealOutputChannelOn: RevealOutputChannelOnEnum;
    private _useRustfmt: boolean | undefined;

    /**
     * Creates a new instance of the class
     * @param rustup The rustup object
     * @param rustSource The rust's source object
     */
    public static async create(rustup: Rustup | undefined, rustSource: RustSource): Promise<RlsConfiguration> {
        const rlsExecutableConfigurationParameter = new ConfigurationParameters.Executable();
        const executableUserPath = await rlsExecutableConfigurationParameter.getCheckedExecutable();
        return new RlsConfiguration(rustup, rustSource, executableUserPath);
    }

    /**
     * Returns if there is some executable path specified by the user
     */
    public isExecutableUserPathSet(): boolean {
        return this._executableUserPath !== undefined;
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
            const userToolchain = this._rustup.getUserNightlyToolchain();
            if (!userToolchain) {
                // It is actually impossible because `isRlsInstalled` uses `getUserNightlyToolchain`
                return this._userArgs;
            }
            return ['run', userToolchain.toString(true, false), 'rls'].concat(this._userArgs);
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
    public getRevealOutputChannelOn(): RevealOutputChannelOnEnum {
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
        this._useRustfmtConfigurationParameter.setUseRustfmt(value);
    }

    private constructor(rustup: Rustup | undefined, rustSource: RustSource, executableUserPath: string | undefined) {
        this._useRustfmtConfigurationParameter = new ConfigurationParameters.UseRustfmt();
        this._rustup = rustup;
        this._rustSource = rustSource;
        this._executableUserPath = executableUserPath;
        this._userArgs = new ConfigurationParameters.Args().getArgs();
        this._userEnv = new ConfigurationParameters.Env().getEnv();
        this._revealOutputChannelOn = new ConfigurationParameters.RevealOutputChannelOn().getRevealOutputChannelOn();
        this._useRustfmt = this._useRustfmtConfigurationParameter.getUseRustfmt();
    }
}

namespace ConfigurationParameters {
    const RLS_CONFIGURATION_PARAMETER_SECTION = 'rust.rls';

    /**
     * The wrapper around the configuration parameter of the RLS executable
     */
    export class Executable {
        /**
         * The configuration parameter of the RLS executable
         */
        private _parameter: ConfigurationParameter;

        public constructor() {
            this._parameter = new ConfigurationParameter(RLS_CONFIGURATION_PARAMETER_SECTION, 'executable');
        }

        /**
         * Gets the executable from the configuration, checks if it exists and returns it
         * @return The existing executable from the configuration
         */
        public async getCheckedExecutable(): Promise<string | undefined> {
            const executable = this._parameter.getValue();
            // It is either string or `null`, but VSCode doens't prevent us from putting a number
            // here
            if (!(typeof executable === 'string')) {
                return undefined;
            }
            // If we passed the previous check, then it is a string, but it may be an empty string. In
            // that case we return `undefined` because an empty string is not valid path
            if (!executable) {
                return undefined;
            }
            // The user may input `~/.cargo/bin/rls` and expect it to work
            const tildeExpandedExecutable = expandTilde(executable);
            // We have to check if the path exists because otherwise the language server wouldn't start
            const foundExecutable = await FileSystem.findExecutablePath(tildeExpandedExecutable);
            return foundExecutable;
        }
    }

    /**
     * The wrapper around the configuration parameter of the RLS arguments
     */
    export class Args {
        /**
         * The configuration parameter of the RLS arguments
         */
        private _parameter: ConfigurationParameter;

        public constructor() {
            this._parameter = new ConfigurationParameter(RLS_CONFIGURATION_PARAMETER_SECTION, 'args');
        }

        /**
         * Gets the arguments from the configuration and returns them
         * @return The arguments
         */
        public getArgs(): string[] {
            const args = this._parameter.getValue();
            // It is either array or `null`, but VSCode doens't prevent us from putting a number
            // here
            if (!(args instanceof Array)) {
                return [];
            }
            return args;
        }
    }

    /**
     * The wrapper around the configuration parameter of the RLS environment
     */
    export class Env {
        /**
         * The configuration parameter of the RLS environment
         */
        private _parameter: ConfigurationParameter;

        public constructor() {
            this._parameter = new ConfigurationParameter(RLS_CONFIGURATION_PARAMETER_SECTION, 'env');
        }

        /**
         * Gets the environment from the configuration and returns it
         * @return The environment
         */
        public getEnv(): object {
            const env = this._parameter.getValue();
            // It is either object or `null`, but VSCode doens't prevent us from putting a number
            // here
            if (!(typeof env === 'object')) {
                return {};
            }
            return env;
        }
    }

    /**
     * The wrapper around the configuration parameter specifying on what kind of message the output
     * channel is revealed
     */
    export class RevealOutputChannelOn {
        /**
         * The configuration parameter specifying on what kind of message the output channel is
         * revealed
         */
        private _parameter: ConfigurationParameter;

        public constructor() {
            this._parameter = new ConfigurationParameter(RLS_CONFIGURATION_PARAMETER_SECTION, 'revealOutputChannelOn');
        }

        /**
         * Gets the value specifying on what kind of message the output channel is revealed from
         * the configuration and returns it
         * @return The environment
         */
        public getRevealOutputChannelOn(): RevealOutputChannelOnEnum {
            const revealOutputChannelOn = this._parameter.getValue();
            switch (revealOutputChannelOn) {
                case 'info':
                    return RevealOutputChannelOnEnum.Info;
                case 'warn':
                    return RevealOutputChannelOnEnum.Warn;
                case 'error':
                    return RevealOutputChannelOnEnum.Error;
                case 'never':
                    return RevealOutputChannelOnEnum.Never;
                default:
                    return RevealOutputChannelOnEnum.Error;
            }
        }
    }

    /**
     * The wrapper around the configuration parameter specifying if rustfmt is used to format code
     */
    export class UseRustfmt {
        /**
         * The configuration parameter specifying if rustfmt is used to format code
         */
        private _parameter: ConfigurationParameter;

        public constructor() {
            this._parameter = new ConfigurationParameter(RLS_CONFIGURATION_PARAMETER_SECTION, 'useRustfmt');
        }

        /**
         * Gets the flag specifying if rustfmt is used to format code from the configuration and returns it
         * @return The environment
         */
        public getUseRustfmt(): boolean | undefined {
            const useRustfmt = this._parameter.getValue();
            // It is either booleans or `null`, but VSCode doens't prevent us from putting a number
            // here
            if (!(typeof useRustfmt === 'boolean')) {
                return undefined;
            }
            return useRustfmt;
        }

        /**
         * Sets the value to the configuration
         * @param useRustfmt The new value
         */
        public setUseRustfmt(useRustfmt: boolean | undefined): void {
            this._parameter.setValue(useRustfmt, true);
        }
    }
}
