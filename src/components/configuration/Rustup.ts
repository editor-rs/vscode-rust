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
     * Requests Rustup update
     * @return true if no error occurred otherwise false
     */
    public async update(): Promise<boolean> {
        const args = ['self', 'update'];

        const stdoutData: string | undefined = await this.invokeRustup(args);

        if (stdoutData === undefined) {
            return false;
        }

        return true;
    }

    /**
     * Requests Rustup install RLS
     * @return true if no error occurred and RLS has been installed otherwise false
     */
    public async installRls(): Promise<boolean> {
        const logger = this.logger.createChildLogger('installRls: ');

        if (this.pathToRlsExecutable) {
            logger.error('RLS is already installed. The method should not have been called');

            // We return true because RLS is installed, but anyway it is an exceptional situation
            return true;
        }

        const args = [
            'component',
            'add',
            Rustup.getRlsComponentName()
        ];

        const stdoutData: string | undefined = await this.invokeRustup(args);

        // Some error occurred. It is already logged in the method invokeRustup.
        // So we just need to notify a caller that the installation failed
        if (stdoutData === undefined) {
            return false;
        }

        // We need to update the field
        await this.updatePathToRlsExecutable();

        if (!this.pathToRlsExecutable) {
            logger.createChildLogger('RLS had been installed successfully, but then Rustup reported that RLS was not installed. This should have not happened');

            return false;
        }

        return true;
    }

    /**
     * Checks if Rust's source code is installed at the expected path.
     * This method assigns either the expected path or undefined to the field `pathToRustSourceCode`, depending on if the expected path exists.
     * The method is asynchronous because it checks if the expected path exists
     */
    public async updatePathToRustSourceCodePath(): Promise<void> {
        const pathToRustSourceCode = join(this.pathToRustcSysRoot, 'lib', 'rustlib', 'src', 'rust', 'src');

        const isRustSourceCodeInstalled: boolean = await FileSystem.doesPathExist(pathToRustSourceCode);

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
            return component.startsWith(Rustup.getRlsComponentName());
        });

        const isRlsInstalled = rlsComponent !== undefined;

        if (!isRlsInstalled) {
            logger.debug('RLS is not installed');

            this.pathToRlsExecutable = undefined;

            return;
        }

        const pathToRlsExecutable: string | undefined = await FileSystem.findExecutablePath(Rustup.getRlsComponentName());

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
     * Requests Rustup give a list of components, parses it, checks if RLS is present in the list and returns if it is
     * @returns true if RLS can be installed otherwise false
     */
    public async canInstallRls(): Promise<boolean> {
        const logger = this.logger.createChildLogger('canRlsBeInstalled: ');

        const components: string[] | undefined = await this.getComponents();

        if (!components) {
            return false;
        }

        const rlsComponent = components.find(component => component.startsWith(Rustup.getRlsComponentName()));

        if (!rlsComponent) {
            return false;
        }

        const isRlsComponentAlreadyInstalled = rlsComponent.endsWith(Rustup.getSuffixForInstalledComponent());

        if (isRlsComponentAlreadyInstalled) {
            logger.error('RLS is already installed. The method should not have been called');

            return false;
        }

        return true;
    }

    /**
     * Requests Rustup give a list of components, parses it and returns it
     * This method is asynchronous because it requests Rustup
     * @returns a list of components if no error occurred otherwise undefined
     */
    private async getComponents(): Promise<string[] | undefined> {
        const logger = this.logger.createChildLogger('getComponents: ');

        const stdoutData: string | undefined = await this.invokeRustup(['component', 'list']);

        if (!stdoutData) {
            return undefined;
        }

        const components: string[] = stdoutData.split('\n');

        if (components.length === 0) {
            // It actually shouldn't happen, but sometimes strange things happen
            logger.error(`Rustup returned no output`);

            return undefined;
        }

        return components;
    }

    /**
     * Invokes Rustup with specified arguments, checks it exited successfully and returns its output
     * @param args Arguments to invoke Rustup with
     * @returns an output if invokation Rustup exited successfully otherwise undefined
     */
    private async invokeRustup(args: string[]): Promise<string | undefined> {
        const logger = this.logger.createChildLogger('invokeRustup: ');

        const rustupExe = Rustup.getRustupExecutable();

        // We assume that the executable of Rustup can be called since usually both `rustc` and `rustup` are placed in the same directory
        const result = await OutputtingProcess.spawn(rustupExe, args, undefined);

        if (!result.success) {
            // It actually shouldn't happen.
            // If it happens, then there is some problem and we need to know about it
            logger.error(`failed to execute ${rustupExe}. This should not have happened`);

            return undefined;
        }

        if (result.exitCode !== 0) {
            logger.error(`${rustupExe} ${args.join(' ')} exited with code=${result.exitCode}, but zero is expected. This should not have happened. stderrData=${result.stderrData}`);

            return undefined;
        }

        return result.stdoutData;
    }

    /**
     * Requests Rustup give a list of components, parses it, filters only installed and returns it
     * @returns a list of installed components if no error occurred otherwise undefined
     */
    private async getInstalledComponents(): Promise<string[] | undefined> {
        const components: string[] | undefined = await this.getComponents();

        if (!components) {
            return undefined;
        }

        const installedComponents = components.filter(component => {
            return component.endsWith(Rustup.getSuffixForInstalledComponent());
        });

        return installedComponents;
    }

    /**
     * Returns the executable of Rustup
     */
    private static getRustupExecutable(): string {
        return 'rustup';
    }

    /**
     * Returns the name of the component RLS
     */
    private static getRlsComponentName(): string {
        return 'rls';
    }

    /**
     * Returns a suffix which any installed component ends with
     */
    private static getSuffixForInstalledComponent(): string {
        return ' (installed)';
    }
}
