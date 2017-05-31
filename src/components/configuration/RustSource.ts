import { FileSystem } from '../file_system/FileSystem';
import { Configuration } from './Configuration';
import { Rustup } from './Rustup';

/**
 * This class provides functionality related to Rust's source
 */
export class RustSource {
    private _path: string | undefined;

    /**
     * Creates a new instance of the class
     * @param rustup The rustup object
     */
    public static async create(rustup: Rustup | undefined): Promise<RustSource> {
        const path = await getPath(rustup);
        return new RustSource(path);
    }

    /**
     * Returns the path
     */
    public getPath(): string | undefined {
        return this._path;
    }

    private constructor(path: string | undefined) {
        this._path = path;
    }
}

async function getPath(rustup: Rustup | undefined): Promise<string | undefined> {
    const userPath = await getUserPath();
    if (userPath) {
        return userPath;
    }
    if (rustup) {
        return rustup.getPathToRustSourceCode();
    } else {
        return undefined;
    }
}

async function getUserPath(): Promise<string | undefined> {
    const configurationPath = await getConfigurationPath();
    if (configurationPath) {
        return configurationPath;
    }
    return await getEnvPath();
}

async function checkPath(path: string | undefined): Promise<string | undefined> {
    if (!path) {
        return undefined;
    }
    if (await FileSystem.doesPathExist(path)) {
        return path;
    } else {
        return undefined;
    }
}

async function getConfigurationPath(): Promise<string | undefined> {
    const path = Configuration.getPathConfigParameter('rustLangSrcPath');
    return await checkPath(path);
}

async function getEnvPath(): Promise<string | undefined> {
    const path = Configuration.getPathEnvParameter('RUST_SRC_PATH');
    return await checkPath(path);
}
