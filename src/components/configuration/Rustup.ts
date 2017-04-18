import { join } from 'path';

import { FileSystem } from '../file_system/FileSystem';

/**
 * Configuration of Rust installed via Rustup
 */
export class Rustup {
    /**
     * A path to Rust's installation root.
     * It is what `rustc --print=sysroot` returns.
     */
    private pathToRustcSysRoot: string;

    /**
     * A path to Rust's source code.
     * It can be undefined if the component "rust-src" is not installed
     */
    private pathToRustSourceCode: string | undefined;

    /**
     * Checks if Rustup manages a specified Rust's installation root
     * @param rustcSysRoot a path to Rust's installation root to check
     * @returns true if Rustup manages it otherwire false
     */
    public static doesManageRustcSysRoot(pathToRustcSysRoot: string): boolean {
        // It can be inaccurate since nobody can stop a user from installing Rust not via Rustup, but to `.rustup` directory
        return pathToRustcSysRoot.includes('.rustup');
    }

    /**
     * Creates a new instance of the class.
     * The method is asynchronous because it tries to find Rust's source code
     * @param pathToRustcSysRoot A path to Rust's installation root
     */
    public static async create(pathToRustcSysRoot: string): Promise<Rustup> {
        const rustup = new Rustup(pathToRustcSysRoot, undefined);

        await rustup.updatePathToRustSourceCodePath();

        return rustup;
    }

    /**
     * Returns the path to Rust's installation root
     */
    public getPathToRustcSysRoot(): string {
        return this.pathToRustcSysRoot;
    }

    /**
     * Returns the path to Rust's source code
     */
    public getPathToRustSourceCode(): string | undefined {
        return this.pathToRustSourceCode;
    }

    /**
     * Checks if Rust's source code is installed at the expected path and sets the field `pathToRustSourceCode` if it is.
     * The method is asynchronous because it checks if the expected path exists
     */
    public async updatePathToRustSourceCodePath(): Promise<void> {
        const pathToRustSourceCode = join(this.pathToRustcSysRoot, 'lib', 'rustlib', 'src', 'rust', 'src');

        const isRustSourceCodeInstalled: boolean = await FileSystem.doesFileOrDirectoryExists(pathToRustSourceCode);

        if (isRustSourceCodeInstalled) {
            this.pathToRustSourceCode = pathToRustSourceCode;
        } else {
            this.pathToRustSourceCode = undefined;
        }
    }

    /**
     * Constructs a new instance of the class.
     * The constructor is private because creating a new instance should be done via the method `create`
     * @param pathToRustcSysRoot A value for the field `pathToRustcSysRoot`
     * @param pathToRustSourceCode A value for the field `pathToRustSourceCode`
     */
    private constructor(pathToRustcSysRoot: string, pathToRustSourceCode: string | undefined) {
        this.pathToRustcSysRoot = pathToRustcSysRoot;

        this.pathToRustSourceCode = pathToRustSourceCode;
    }
}
