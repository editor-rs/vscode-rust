import { join } from 'path';
import { OutputtingProcess } from '../../OutputtingProcess';
import { Toolchain } from '../../Toolchain';
import { FileSystem } from '../file_system/FileSystem';
import { ChildLogger } from '../logging/child_logger';
import * as OutputChannelProcess from '../../OutputChannelProcess';
import { Configuration } from './Configuration';

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
    private pathToRustcSysRoot: string | undefined;

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
    private components: { [toolchain: string]: string[] | undefined };

    /**
     * Toolchains received by invoking rustup
     */
    private toolchains: Toolchain[];

    /**
     * The toolchain chosen by the user
     */
    private _userToolchain: Toolchain | undefined;


    /**
     * Returns the executable of Rustup
     */
    public static getRustupExecutable(): string {
        return 'rustup';
    }

    /**
     * Creates a new instance of the class.
     * The method is asynchronous because it tries to find Rust's source code
     * @param pathToRustcSysRoot A path to Rust's installation root
     */
    public static async create(logger: ChildLogger): Promise<Rustup | undefined> {
        const rustupExe = await FileSystem.findExecutablePath(Rustup.getRustupExecutable());
        if (!rustupExe) {
            return undefined;
        }
        const rustup = new Rustup(logger);
        return rustup;
    }

    /**
     * Return either the only nightly toolchain or undefined if there is no nightly toolchain or
     * there are several nightly toolchains
     */
    public getNightlyToolchain(logger: ChildLogger): Toolchain | undefined {
        const functionLogger = logger.createChildLogger('getNightlyToolchain: ');
        const nightlyToolchains = this.getNightlyToolchains();
        switch (nightlyToolchains.length) {
            case 0:
                functionLogger.error('There is no nightly toolchain');
                return undefined;
            case 1:
                functionLogger.debug('There is only one nightly toolchain');
                return nightlyToolchains[0];
            default:
                functionLogger.debug(`There are ${nightlyToolchains.length} nightly toolchains`);
                return undefined;
        }
    }

    /**
     * Returns either the default toolchain or undefined if there are no installed toolchains
     */
    public getDefaultToolchain(): Toolchain | undefined {
        const logger = this.logger.createChildLogger('getDefaultToolchain: ');
        const toolchain = this.toolchains.find(t => t.isDefault);
        if (!toolchain && this.toolchains.length !== 0) {
            logger.error(`no default toolchain; this.toolchains=${this.toolchains}`);
        }
        return toolchain;
    }

    /**
     * Returns the toolchains received from the last rustup invocation
     */
    public getToolchains(): Toolchain[] {
        return this.toolchains;
    }

    /**
     * Checks if the toolchain is installed
     * @param toolchain The toolchain to check
     */
    public isToolchainInstalled(toolchain: Toolchain): boolean {
        return this.toolchains.find(t => t.equals(toolchain)) !== undefined;
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
     * Returns either the toolchain chosen by the user or undefined
     */
    public getUserToolchain(): Toolchain | undefined {
        return this._userToolchain;
    }

    public setUserToolchain(toolchain: Toolchain | undefined): void {
        if (this._userToolchain === toolchain) {
            return;
        }
        this._userToolchain = toolchain;
        updateUserConfigurationParameter(c => c.toolchain = toolchain ? toolchain.toString(true, false) : null);
    }

    /**
     * Requests rustup to install the specified toolchain
     * @param toolchain The toolchain to install
     * @return true if no error occurred and the toolchain has been installed otherwise false
     */
    public async installToolchain(toolchain: string): Promise<boolean> {
        const logger = this.logger.createChildLogger(`installToolchain(toolchain=${toolchain}): `);
        const args = ['toolchain', 'install', toolchain];
        const outputChannelName = `Rustup: Installing ${toolchain} toolchain`;
        const output = await Rustup.invokeWithOutputChannel(args, logger, outputChannelName);
        if (output === undefined) {
            logger.error(`output=${output}`);
            return false;
        }
        logger.debug(`output=${output}`);
        await this.updateToolchains();
        if (this.toolchains.length === 0) {
            logger.error('this.toolchains.length === 0');
            return false;
        }
        return true;
    }

    /**
     * Requests Rustup to install rust-src for the chosen toolchain
     * @return true if the installing succeeded, otherwise false
     */
    public async installRustSrc(): Promise<boolean> {
        const logger = this.logger.createChildLogger('installRustSrc: ');
        if (!this._userToolchain) {
            logger.error('no toolchain has been chosen');
            return false;
        }
        return await this.installComponent(this._userToolchain, 'rust-src');
    }

    /**
     * Requests Rustup install RLS
     * @return true if no error occurred and RLS has been installed otherwise false
     */
    public async installRls(): Promise<boolean> {
        const logger = this.logger.createChildLogger('installRls: ');
        const nightlyToolchain = this.getNightlyToolchain(logger);
        if (!nightlyToolchain) {
            logger.error('no nightly toolchain');
            return false;
        }
        const isComponentInstalled: boolean = await this.installComponent(
            nightlyToolchain,
            Rustup.getRlsComponentName()
        );
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
        const logger = this.logger.createChildLogger('installRustAnalysis: ');
        const nightlyToolchain = this.getNightlyToolchain(logger);
        if (!nightlyToolchain) {
            logger.error('no nightly toolchain');
            return false;
        }
        return await this.installComponent(
            nightlyToolchain,
            Rustup.getRustAnalysisComponentName()
        );
    }

    /**
     * Requests rustup to give components list and saves them in the field `components`
     */
    public async updateComponents(toolchain: Toolchain): Promise<void> {
        const logger = this.logger.createChildLogger(`updateComponents(${toolchain.toString(true, false)}): `);
        const toolchainAsString = toolchain.toString(true, false);
        this.components[toolchainAsString] = [];
        const rustupArgs = ['component', 'list', '--toolchain', toolchainAsString];
        const stdoutData: string | undefined = await Rustup.invoke(rustupArgs, logger);
        if (!stdoutData) {
            logger.error(`stdoutData=${stdoutData}`);
            return;
        }
        this.components[toolchainAsString] = stdoutData.split('\n');
        logger.debug(`components=${JSON.stringify(this.components[toolchainAsString])}`);
    }

    /**
     * Requests rustup to give toolchains list and saves it in the field `toolchains`
     */
    public async updateToolchains(): Promise<void> {
        const logger = this.logger.createChildLogger('updateToolchains: ');
        this.toolchains = await Rustup.invokeGettingToolchains(logger);
        logger.debug(`this.toolchains=${JSON.stringify(this.toolchains)}`);
    }

    /**
     * Requests rustup to give the path to the sysroot of the specified toolchain
     * @param toolchain The toolchain to get the path to the sysroot for
     */
    public async updateSysrootPath(toolchain: Toolchain): Promise<void> {
        this.pathToRustcSysRoot = undefined;
        const logger = this.logger.createChildLogger(`updateSysrootPath: toolchain=${toolchain}: `);
        if (!this.toolchains.find(t => t.equals(toolchain))) {
            logger.error('toolchain is not installed');
            return;
        }
        this.pathToRustcSysRoot = await Rustup.invokeGettingSysrootPath(toolchain, logger);
        if (!this.pathToRustcSysRoot) {
            logger.error(`this.pathToRustcSysRoot=${this.pathToRustcSysRoot}`);
        }
    }

    /**
     * Checks if Rust's source code is installed at the expected path.
     * This method assigns either the expected path or undefined to the field `pathToRustSourceCode`, depending on if the expected path exists.
     * The method is asynchronous because it checks if the expected path exists
     */
    public async updatePathToRustSourceCodePath(): Promise<void> {
        const logger = this.logger.createChildLogger('updatePathToRustSourceCodePath: ');
        this.pathToRustSourceCode = undefined;
        if (!this.pathToRustcSysRoot) {
            logger.error(`this.pathToRustcSysRoot=${this.pathToRustcSysRoot}`);
            return;
        }
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
        const nightlyToolchain = this.getNightlyToolchain(logger);
        if (!nightlyToolchain) {
            logger.error('no nightly toolchain');
            return false;
        }
        const components = this.components[nightlyToolchain.toString(true, false)];
        if (!components) {
            logger.error('no components');
            return false;
        }
        const rlsComponent = components.find(component => component.startsWith(Rustup.getRlsComponentName()));
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
        const logger = this.logger.createChildLogger('isRlsInstalled: ');
        const nightlyToolchain = this.getNightlyToolchain(logger);
        if (!nightlyToolchain) {
            logger.error('no nightly toolchain');
            return false;
        }
        return this.isComponentInstalled(nightlyToolchain, Rustup.getRlsComponentName());
    }

    /**
     * Returns whether "rust-analysis" is installed
     * @return The flag indicating whether "rust-analysis" is installed
     */
    public isRustAnalysisInstalled(): boolean {
        const logger = this.logger.createChildLogger('isRustAnalysisInstalled: ');
        const nightlyToolchain = this.getNightlyToolchain(logger);
        if (!nightlyToolchain) {
            logger.error('no nightly toolchain');
            return false;
        }
        return this.isComponentInstalled(nightlyToolchain, Rustup.getRustAnalysisComponentName());
    }

    /**
     * Returns true if the component `rust-analysis` can be installed otherwise false.
     * If the component is already installed, the method returns false
     */
    public canInstallRustAnalysis(): boolean {
        const logger = this.logger.createChildLogger('canInstallRustAnalysis: ');
        const nightlyToolchain = this.getNightlyToolchain(logger);
        if (!nightlyToolchain) {
            logger.error('no nightly toolchain');
            return false;
        }
        const components = this.components[nightlyToolchain.toString(true, false)];
        if (!components) {
            logger.error('no components');
            return false;
        }
        const component: string | undefined = components.find(c => c.startsWith(Rustup.getRustAnalysisComponentName()));
        if (!component) {
            return false;
        }
        const componentInstalled: boolean = component.endsWith(Rustup.getSuffixForInstalledComponent());
        return !componentInstalled;
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
    private static async invokeGettingSysrootPath(
        toolchain: Toolchain,
        logger: ChildLogger
    ): Promise<string | undefined> {
        const args = ['run', toolchain.toString(true, false), 'rustc', '--print', 'sysroot'];
        const output: string | undefined = await this.invoke(args, logger);
        if (!output) {
            return undefined;
        }
        return output.trim();
    }

    private static async invokeGettingToolchains(logger: ChildLogger): Promise<Toolchain[]> {
        const functionLogger = logger.createChildLogger('invokeGettingToolchains: ');
        const output = await this.invoke(['toolchain', 'list'], functionLogger);
        if (!output) {
            functionLogger.error(`output=${output}`);
            return [];
        }
        const toolchainsAsStrings = output.trim().split('\n');
        const toolchains = [];
        for (const toolchainAsString of toolchainsAsStrings) {
            const toolchain = Toolchain.parse(toolchainAsString);
            if (toolchain) {
                toolchains.push(toolchain);
            }
        }
        return toolchains;
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
     * Invokes rustup with the specified arguments, creates an output channel with the specified
     * name, writes output of the invocation and returns the output
     * @param args The arguments which to invoke rustup with
     * @param logger The logger to log messages
     * @param outputChannelName The name which to create an output channel with
     */
    private static async invokeWithOutputChannel(args: string[], logger: ChildLogger,
        outputChannelName: string): Promise<string | undefined> {
        const functionLogger = logger.createChildLogger(`invokeWithOutputChannel(args=${JSON.stringify(args)}, outputChannelName=${outputChannelName}): `);
        const result = await OutputChannelProcess.create(this.getRustupExecutable(), args, undefined, outputChannelName);
        if (!result.success) {
            functionLogger.error('failed to start');
            return undefined;
        }
        if (result.code !== 0) {
            functionLogger.error(`exited with not zero; code=${result.code}`);
            functionLogger.error('Beginning of stdout');
            functionLogger.error(result.stdout);
            functionLogger.error('Ending of stdout');
            functionLogger.error('Beginning of stderr');
            functionLogger.error(result.stderr);
            functionLogger.error('Ending of stderr');
            return undefined;
        }
        return result.stdout;
    }

    /**
     * Constructs a new instance of the class.
     * The constructor is private because creating a new instance should be done via the method `create`
     * @param logger A value for the field `logger`
     * @param pathToRustcSysRoot A value for the field `pathToRustcSysRoot`
     * @param pathToRustSourceCode A value for the field `pathToRustSourceCode`
     * @param pathToRlsExecutable A value fo the field `pathToRlsExecutable`
     */
    private constructor(logger: ChildLogger) {
        this.logger = logger;
        this.pathToRustcSysRoot = undefined;
        this.pathToRustSourceCode = undefined;
        this.pathToRlsExecutable = undefined;
        this.components = {};
        this.toolchains = [];
        this._userToolchain = getUserToolchain();
    }

    private getNightlyToolchains(): Toolchain[] {
        return this.toolchains.filter(t => t.channel === 'nightly');
    }

    /**
     * Takes from the field `components` only installed components
     * @returns a list of installed components
     */
    private getInstalledComponents(toolchain: Toolchain): string[] {
        const toolchainAsString = toolchain.toString(true, false);
        const components = this.components[toolchainAsString];
        if (!components) {
            return [];
        }
        const installedComponents = components.filter(component => {
            return component.endsWith(Rustup.getSuffixForInstalledComponent());
        });
        return installedComponents;
    }

    /**
     * Returns true if the component is installed otherwise false
     * @param componentName The component's name
     */
    private isComponentInstalled(toolchain: Toolchain, componentName: string): boolean {
        const installedComponents: string[] = this.getInstalledComponents(toolchain);
        const component: string | undefined = installedComponents.find(c => c.startsWith(componentName));
        const isComponentInstalled = component !== undefined;
        return isComponentInstalled;
    }

    private async installComponent(toolchain: Toolchain, componentName: string): Promise<boolean> {
        const logger = this.logger.createChildLogger(`installComponent(${toolchain}, ${componentName}: `);
        if (this.isComponentInstalled(toolchain, componentName)) {
            logger.error(`${componentName} is already installed. The method should not have been called`);
            // We return true because the component is installed, but anyway it is an exceptional situation
            return true;
        }
        const args = ['component', 'add', componentName, '--toolchain', toolchain.toString(true, false)];
        const stdoutData = await Rustup.invokeWithOutputChannel(args, logger, `Rustup: Installing ${componentName}`);
        if (stdoutData === undefined) {
            // Some error occurred. It is already logged
            // So we just need to notify a caller that the installation failed
            return false;
        }
        await this.updateComponents(toolchain);
        if (!this.isComponentInstalled(toolchain, componentName)) {
            logger.error(`${componentName} had been installed successfully, but then Rustup reported that the component was not installed. This should have not happened`);
            return false;
        }
        return true;
    }
}

function getUserConfiguration(): any {
    const configuration = Configuration.getConfiguration();
    if (!configuration) {
        return undefined;
    }
    const rustupConfiguration = configuration.get<any>('rustup');
    if (!rustupConfiguration) {
        return undefined;
    }
    return rustupConfiguration;
}

function getUserToolchain(): Toolchain | undefined {
    const rustupConfiguration = getUserConfiguration();
    if (!rustupConfiguration) {
        return undefined;
    }
    const toolchainAsString = rustupConfiguration.toolchain;
    if (!toolchainAsString) {
        return undefined;
    }
    const toolchain = Toolchain.parse(toolchainAsString);
    if (toolchain) {
        return toolchain;
    } else {
        return undefined;
    }
}

function updateUserConfigurationParameter(updateParameter: (c: any) => void): void {
    let configuration = getUserConfiguration();
    if (!configuration) {
        configuration = {};
    }
    updateParameter(configuration);
    Configuration.getConfiguration().update('rustup', configuration, true);
}
