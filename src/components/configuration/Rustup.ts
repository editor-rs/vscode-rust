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
     * Components received by invoking rustup
     */
    private components: string[];

    /**
     * Checks if Rustup manages a specified Rust's installation root
     * @param rustcSysRoot a path to Rust's installation root to check
     * @returns true if Rustup manages it otherwire false
     */
    public static doesManageRustcSysRoot(pathToRustcSysRoot: string): boolean {
        // Usually rustup installs itself to the directory `.rustup` so if the sysroot is in the directory `.rustup`, then it is controlled by rustup.
        // Also a user can specify a directory to install rustup to by specifying the environment variable `RUSTUP_HOME`
        const rustupHome: string | undefined = process.env.RUSTUP_HOME;
        if (rustupHome) {
            return pathToRustcSysRoot.startsWith(rustupHome);
        } else {
            // It can be inaccurate since nobody can stop a user from installing Rust not via Rustup, but to `.rustup` directory
            return pathToRustcSysRoot.includes('.rustup');
        }
    }

    /**
     * Creates a new instance of the class.
     * The method is asynchronous because it tries to find Rust's source code
     * @param pathToRustcSysRoot A path to Rust's installation root
     */
    public static async create(logger: ChildLogger): Promise<Rustup | undefined> {
        const sysrootPath: string | undefined = await this.invokeGettingSysrootPath('nightly', logger);
        if (!sysrootPath) {
            return undefined;
        }
        const rustup = new Rustup(logger, sysrootPath, undefined, undefined);
        await rustup.updatePathToRustSourceCodePath();
        await rustup.updateComponents();
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
     * Requests Rustup install RLS
     * @return true if no error occurred and RLS has been installed otherwise false
     */
    public async installRls(): Promise<boolean> {
        const logger = this.logger.createChildLogger('installRls: ');
        const isComponentInstalled: boolean = await this.installComponent(Rustup.getRlsComponentName());
        if (!isComponentInstalled) {
            return false;
        }
        // We need to update the field
        await this.updatePathToRlsExecutable();
        if (!this.pathToRlsExecutable) {
            logger.error('RLS had been installed successfully, but we failed to find it in PATH. This should have not happened');

            return false;
        }
        return true;
    }

    /**
     * Requests Rustup install rust-analysis
     * @return true if no error occurred and rust-analysis has been installed otherwise false
     */
    public async installRustAnalysis(): Promise<boolean> {
        return await this.installComponent(Rustup.getRustAnalysisComponentName());
    }

    /**
     * Requests rustup to give components list and saves them in the field `components`
     */
    public async updateComponents(): Promise<void> {
        const logger = this.logger.createChildLogger('updateComponents: ');
        const stdoutData: string | undefined = await Rustup.invoke(['component', 'list', '--toolchain', 'nightly'], logger);
        if (!stdoutData) {
            logger.error(`stdoutData=${stdoutData}`);
            return undefined;
        }
        this.components = stdoutData.split('\n');
        logger.debug(`this.components=${JSON.stringify(this.components)}`);
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
        this.pathToRlsExecutable = undefined;
        const rlsInstalled: boolean = this.isComponentInstalled(Rustup.getRlsComponentName());
        logger.debug(`rlsInstalled=${rlsInstalled}`);
        if (!rlsInstalled) {
            return;
        }
        const rlsPath: string | undefined = await FileSystem.findExecutablePath('rls');
        logger.debug(`rlsPath=${rlsPath}`);
        if (!rlsPath) {
            // RLS is installed via Rustup, but isn't found. Let a user know about it
            logger.error(`Rustup had reported that RLS had been installed, but RLS wasn't found in PATH=${process.env.PATH}`);
            return;
        }
        this.pathToRlsExecutable = rlsPath;
    }

    /**
     * Requests Rustup give a list of components, parses it, checks if RLS is present in the list and returns if it is
     * @returns true if RLS can be installed otherwise false
     */
    public canInstallRls(): boolean {
        const logger = this.logger.createChildLogger('canInstallRls: ');
        const rlsComponent = this.components.find(component => component.startsWith(Rustup.getRlsComponentName()));
        if (!rlsComponent) {
            return false;
        }
        const rlsInstalled = rlsComponent.endsWith(Rustup.getSuffixForInstalledComponent());
        if (rlsInstalled) {
            logger.error('RLS is already installed. The method should not have been called');
            return false;
        }
        return true;
    }

    /**
     * Returns if RLS is installed
     * @return true if RLS is installed otherwise false
     */
    public isRlsInstalled(): boolean {
        return this.isComponentInstalled(Rustup.getRlsComponentName());
    }

    /**
     * Returns true if the component `rust-analysis` can be installed otherwise false.
     * If the component is already installed, the method returns false
     */
    public canInstallRustAnalysis(): boolean {
        const component: string | undefined = this.components.find(c => c.startsWith(Rustup.getRustAnalysisComponentName()));
        if (!component) {
            return false;
        }
        const componentInstalled: boolean = component.endsWith(Rustup.getSuffixForInstalledComponent());
        return !componentInstalled;
    }

    /**
     * Returns the executable of Rustup
     */
    private static getRustupExecutable(): string {
        return 'rustup';
    }

    /**
     * Returns the name of the component rust-analysis
     */
    private static getRustAnalysisComponentName(): string {
        return 'rust-analysis';
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

    /**
     * Invokes rustup to get the path to the sysroot of the specified toolchain.
     * Checks if the invocation exited successfully and returns the output of the invocation
     * @param toolchain The toolchain to get the path to the sysroot for
     * @param logger The logger to log messages
     * @return The output of the invocation if the invocation exited successfully otherwise undefined
     */
    private static async invokeGettingSysrootPath(toolchain: string, logger: ChildLogger): Promise<string | undefined> {
        const output: string | undefined = await this.invokeRun(toolchain, ['rustc', '--print', 'sysroot'], logger);
        if (!output) {
            return undefined;
        }
        return output.trim();
    }

    /**
     * Invokes `rustup run...` with the specified toolchain and arguments, checks if it exited successfully and returns its output
     * @param toolchain The toolchain to invoke rustup with
     * @param args The arguments to invoke rustup with
     * @param logger The logger to log messages
     */
    private static async invokeRun(toolchain: string, args: string[], logger: ChildLogger): Promise<string | undefined> {
        return await this.invoke(['run', toolchain, ...args], logger);
    }

    /**
     * Invokes Rustup with specified arguments, checks if it exited successfully and returns its output
     * @param args Arguments to invoke Rustup with
     * @param logger The logger to log messages
     * @returns an output if invocation exited successfully otherwise undefined
     */
    private static async invoke(args: string[], logger: ChildLogger): Promise<string | undefined> {
        const rustupExe = Rustup.getRustupExecutable();
        const functionLogger = logger.createChildLogger(`invoke: rustupExe=${rustupExe}, args=${JSON.stringify(args)}: `);
        const result = await OutputtingProcess.spawn(rustupExe, args, undefined);
        if (!result.success) {
            functionLogger.error('failed');
            return undefined;
        }
        if (result.exitCode !== 0) {
            functionLogger.error(`exited unexpectedly; exitCode=${result.exitCode}, stderrData=${result.stderrData}`);
            return undefined;
        }
        return result.stdoutData;
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

        this.components = [];
    }

    /**
     * Takes from the field `components` only installed components
     * @returns a list of installed components
     */
    private getInstalledComponents(): string[] {
        const installedComponents = this.components.filter(component => {
            return component.endsWith(Rustup.getSuffixForInstalledComponent());
        });
        return installedComponents;
    }

    /**
     * Returns true if the component is installed otherwise false
     * @param componentName The component's name
     */
    private isComponentInstalled(componentName: string): boolean {
        const installedComponents: string[] = this.getInstalledComponents();
        const component: string | undefined = installedComponents.find(c => c.startsWith(componentName));
        const isComponentInstalled = component !== undefined;
        return isComponentInstalled;
    }

    private async installComponent(componentName: string): Promise<boolean> {
        const logger = this.logger.createChildLogger(`installComponent(${componentName}: `);
        if (this.isComponentInstalled(componentName)) {
            logger.error(`${componentName} is already installed. The method should not have been called`);
            // We return true because the component is installed, but anyway it is an exceptional situation
            return true;
        }
        const args = ['component', 'add', componentName, '--toolchain', 'nightly'];
        const stdoutData: string | undefined = await Rustup.invoke(args, logger);
        // Some error occurred. It is already logged in the method invokeRustup.
        // So we just need to notify a caller that the installation failed
        if (stdoutData === undefined) {
            return false;
        }
        await this.updateComponents();
        if (!this.isComponentInstalled(componentName)) {
            logger.error(`${componentName} had been installed successfully, but then Rustup reported that the component was not installed. This should have not happened`);
            return false;
        }
        return true;
    }
}
