import { Configuration } from './components/configuration/Configuration';
import { Rustup } from './components/configuration/Rustup';

/**
 * The class defines functions which can be used to get data required to invoke Cargo
 */
export class CargoInvocationManager {
    private _configuration: Configuration;
    private _rustup: Rustup | undefined;

    public constructor(configuration: Configuration, rustup: Rustup | undefined) {
        this._configuration = configuration;
        this._rustup = rustup;
    }

    /**
     * Cargo can be accessible from multiple places, but the only one is correct.
     * This function determines the path to the executable which either Cargo itself or proxy to
     * Cargo. If the executable is a proxy to Cargo, then the proxy may require some arguments to
     * understand that Cargo is requested. An example is running Cargo using rustup.
     */
    public getExecutableAndArgs(): { executable: string, args: string[] } {
        const userCargoPath = this._configuration.getCargoPath();
        if (userCargoPath) {
            return { executable: userCargoPath, args: [] };
        }
        const userToolchain = this._rustup ? this._rustup.getUserToolchain() : undefined;
        if (!userToolchain) {
            return { executable: 'cargo', args: [] };
        }
        const args = ['run', userToolchain.toString(true, false), 'cargo'];
        return { executable: Rustup.getRustupExecutable(), args };
    }
}
