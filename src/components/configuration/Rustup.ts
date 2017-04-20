import { join } from 'path';

// import { EOL } from 'os';

import { OutputtingProcess } from '../../OutputtingProcess';

import { FileSystem } from '../file_system/FileSystem';

import ChildLogger from '../logging/child_logger';

/**
 * Configuration of Rust installed via Rustup
 */
export class Rustup {
    /**
     * A logger to log messages
     */
    private logger: ChildLogger;

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
     * A path to the executable of RLS.
     * It can be undefined if the component "rls" is not installed
     */
    private pathToRlsExecutable: string | undefined;

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
    public static async create(logger: ChildLogger, pathToRustcSysRoot: string): Promise<Rustup> {
        const rustup = new Rustup(logger, pathToRustcSysRoot, undefined, undefined);

        await rustup.updatePathToRustSourceCodePath();

        await rustup.updatePathToRlsExecutable();

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
     * Returns either the path to the executable of RLS or undefined
     */
    public getPathToRlsExecutable(): string | undefined {
        return this.pathToRlsExecutable;
    }

    /**
     * Checks if Rust's source code is installed at the expected path.
     * This method assigns either the expected path or undefined to the field `pathToRustSourceCode`, depending on if the expected path exists.
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
     * Checks if the executable of RLS is installed.
     * This method assigns either a path to the executable or undefined to the field `pathToRlsExecutable`, depending on if the executable is found
     * This method is asynchronous because it checks if the executable exists
     */
    public async updatePathToRlsExecutable(): Promise<void> {
        const logger = this.logger.createChildLogger('updatePathToRlsExecutable: ');

        const installedComponents: string[] | undefined = await this.getInstalledComponents();

        if (!installedComponents) {
            this.pathToRlsExecutable = undefined;

            return;
        }

        const rlsComponent = installedComponents.find(component => {
            return component.startsWith('rls');
        });

        const isRlsInstalled = rlsComponent !== undefined;

        if (!isRlsInstalled) {
            logger.debug('RLS is not installed');

            this.pathToRlsExecutable = undefined;
        }

        const pathToRlsExecutable: string | undefined = await FileSystem.findExecutablePath('rls');

        if (!pathToRlsExecutable) {
            // RLS is installed via Rustup, but isn't found. Let a user know about it
            logger.error(`Rustup had reported that RLS had been installed, but RLS wasn't found in PATH=${process.env.PATH}`);

            this.pathToRlsExecutable = undefined;

            return;
        }

        this.pathToRlsExecutable = pathToRlsExecutable;

        logger.debug(`RLS is installed. Path=${this.pathToRlsExecutable}`);
    }

    /**
     * Constructs a new instance of the class.
     * The constructor is private because creating a new instance should be done via the method `create`
     * @param logger A value for the field `logger`
     * @param pathToRustcSysRoot A value for the field `pathToRustcSysRoot`
     * @param pathToRustSourceCode A value for the field `pathToRustSourceCode`
     * @param pathToRlsExecutable A value fo the field `pathToRlsExecutable`
     */
    private constructor(
        logger: ChildLogger,
        pathToRustcSysRoot: string,
        pathToRustSourceCode: string | undefined,
        pathToRlsExecutable: string | undefined
    ) {
        this.logger = logger;

        this.pathToRustcSysRoot = pathToRustcSysRoot;

        this.pathToRustSourceCode = pathToRustSourceCode;

        this.pathToRlsExecutable = pathToRlsExecutable;
    }

    /**
     * Requests Rustup give a list of installed components, parses it and returns it
     * @returns a list of installed components if no error occurred otherwise undefined
     */
    private async getInstalledComponents(): Promise<string[] | undefined> {
        const logger = this.logger.createChildLogger('getInstalledComponents: ');

        const rustupExe = 'rustup';

        const args = ['component', 'list'];

        // We assume that the executable of Rustup can be called since usually both `rustc` and `rustup` are placed in the same directory
        const output = await OutputtingProcess.spawn(rustupExe, ['component', 'list'], undefined);

        if (!output.success) {
            // It actually shouldn't happen.
            // If it happens, then there is some problem and we need to know about it
            logger.error(`failed to execute ${rustupExe}`);

            return undefined;
        }

        if (output.exitCode !== 0) {
            logger.error(`${rustupExe} ${args.join(' ')} exited with code=${output.exitCode}, but zero is expected`);

            return undefined;
        }

        const components: string[] = output.stdoutData.split('\n');

        if (components.length === 0) {
            // It actually shouldn't happen, but sometimes strange things happen
            logger.error(`${rustupExe} ${args.join(' ')} returned no output`);

            return undefined;
        }

        const installedComponents = components.filter(component => {
            return component.endsWith(' (installed)');
        });

        return installedComponents;
    }
}
