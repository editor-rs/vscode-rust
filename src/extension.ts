// https://github.com/pwnall/node-open
import open = require('open');
import { ExtensionContext, window, workspace } from 'vscode';
import { CargoManager, CommandInvocationReason } from './components/cargo/cargo_manager';
import { Configuration, Mode } from './components/configuration/Configuration';
import { CurrentWorkingDirectoryManager }
    from './components/configuration/current_working_directory_manager';
import { RustSource } from './components/configuration/RustSource';
import { Rustup } from './components/configuration/Rustup';
import { RlsConfiguration } from './components/configuration/RlsConfiguration';
import { FormattingManager } from './components/formatting/formatting_manager';
import { Manager as LanguageClientManager } from './components/language_client/manager';
import { LoggingManager } from './components/logging/logging_manager';
import { ChildLogger } from './components/logging/child_logger';
import { RootLogger } from './components/logging/root_logger';
import { LegacyModeManager } from './legacy_mode_manager';
import * as OutputChannelProcess from './OutputChannelProcess';

/**
 * Asks the user to choose a mode which the extension will run in.
 * It is possible that the user will decline choosing and in that case the extension will run in
 * Legacy Mode
 * @return The promise which is resolved with either the chosen mode by the user or undefined
 */
async function askUserToChooseMode(): Promise<Mode | undefined> {
    const message = 'Choose a mode in which the extension will function';
    const rlsChoice = 'RLS';
    const legacyChoice = 'Legacy';
    const readAboutChoice = 'Read about modes';
    while (true) {
        const choice = await window.showInformationMessage(message, rlsChoice, legacyChoice,
            readAboutChoice);
        switch (choice) {
            case rlsChoice:
                return Mode.RLS;
            case legacyChoice:
                return Mode.Legacy;
            case readAboutChoice:
                open('https://github.com/editor-rs/vscode-rust/blob/master/doc/main.md');
                break;
            default:
                return undefined;
        }
    }
}

/**
 * Asks the user's permission to install something
 * @param what What to install
 * @return The flag indicating whether the user gave the permission
 */
async function askPermissionToInstall(what: string): Promise<boolean> {
    const installChoice = 'Install';
    const message = `It seems ${what} is not installed. Do you want to install it?`;
    const choice = await window.showInformationMessage(message, installChoice);
    return choice === installChoice;
}

/**
 * Handles the case when rustup reported that the nightly toolchain wasn't installed
 * @param logger The logger to log messages
 * @param rustup The rustup
 */
async function handleMissingNightlyToolchain(logger: ChildLogger, rustup: Rustup): Promise<boolean> {
    const functionLogger = logger.createChildLogger('handleMissingNightlyToolchain: ');
    await window.showInformationMessage('The nightly toolchain is not installed, but is required to install RLS');
    const permissionGranted = await askPermissionToInstall('the nightly toolchain');
    functionLogger.debug(`permissionGranted= ${permissionGranted}`);
    if (!permissionGranted) {
        return false;
    }
    window.showInformationMessage('The nightly toolchain is being installed. It can take a while. Please be patient');
    const toolchainInstalled = await rustup.installToolchain('nightly');
    functionLogger.debug(`toolchainInstalled= ${toolchainInstalled}`);
    if (!toolchainInstalled) {
        return false;
    }
    await rustup.updateComponents();
    return true;
}

class RlsMode {
    private _configuration: Configuration;
    private _rlsConfiguration: RlsConfiguration;
    private _rustup: Rustup | undefined;
    private _logger: ChildLogger;
    private _extensionContext: ExtensionContext;

    public constructor(
        configuration: Configuration,
        rlsConfiguration: RlsConfiguration,
        rustup: Rustup | undefined,
        logger: ChildLogger,
        extensionContext: ExtensionContext
    ) {
        this._configuration = configuration;
        this._rlsConfiguration = rlsConfiguration;
        this._rustup = rustup;
        this._logger = logger;
        this._extensionContext = extensionContext;
    }

    /**
     * Starts the extension in RLS mode
     * @return The flag indicating whether the extension has been started in RLS mode
     */
    public async start(): Promise<boolean> {
        const logger = this._logger.createChildLogger('start: ');
        {
            const mode = this._configuration.mode();
            if (mode !== Mode.RLS) {
                logger.error(`mode=${mode}; this method should not have been called`);
                return false;
            }
        }
        if (!this._rlsConfiguration.getExecutablePath()) {
            logger.debug('no RLS executable');
            if (this._rustup) {
                const rlsInstalled = await this.handleMissingRls();
                if (!rlsInstalled) {
                    logger.debug('RLS has not been installed');
                    this._configuration.setMode(undefined);
                    return false;
                }
            } else {
                logger.debug('no rustup');
                await this.handleMissingRlsAndRustup();
                return false;
            }
        }
        if (this._rlsConfiguration.getUseRustfmt() === undefined) {
            await this.handleMissingValueForUseRustfmt();
        }
        // The user may have chosen whether rustfmt should be used
        if (this._rlsConfiguration.getUseRustfmt()) {
            const formattingManager = await FormattingManager.create(
                this._extensionContext,
                this._configuration
            );
            if (formattingManager === undefined) {
                await this.handleMissingRustfmt();
                // The user may have decided not to use rustfmt
                if (this._rlsConfiguration.getUseRustfmt()) {
                    const anotherFormattingManager = await FormattingManager.create(
                        this._extensionContext,
                        this._configuration
                    );
                    if (anotherFormattingManager === undefined) {
                        window.showErrorMessage('Formatting: some error happened');
                    }
                }
            }
        }
        const rlsPath = <string>this._rlsConfiguration.getExecutablePath();
        logger.debug(`rlsPath= ${rlsPath} `);
        const env = this._rlsConfiguration.getEnv();
        logger.debug(`env= ${JSON.stringify(env)} `);
        const args = this._rlsConfiguration.getArgs();
        logger.debug(`args= ${JSON.stringify(args)} `);
        const revealOutputChannelOn = this._rlsConfiguration.getRevealOutputChannelOn();
        logger.debug(`revealOutputChannelOn= ${revealOutputChannelOn} `);
        const languageClientManager = new LanguageClientManager(
            this._extensionContext,
            logger.createChildLogger('Language Client Manager: '),
            rlsPath,
            args,
            env,
            revealOutputChannelOn
        );
        languageClientManager.initialStart();
        return true;
    }

    private async handleMissingRlsAndRustup(): Promise<void> {
        const logger = this._logger.createChildLogger('handleMissingRlsAndRustupWhenModeIsRls: ');
        logger.debug('enter');
        const message = 'You have chosen RLS mode, but neither RLS nor rustup is installed';
        const switchToLegacyModeChoice = 'Switch to Legacy mode';
        const askMeLaterChoice = 'Ask me later';
        const choice = await window.showErrorMessage(message, switchToLegacyModeChoice, askMeLaterChoice);
        switch (choice) {
            case switchToLegacyModeChoice:
                this._configuration.setMode(Mode.Legacy);
                break;
            case askMeLaterChoice:
            default:
                this._configuration.setMode(undefined);
                break;
        }
    }

    private async handleMissingValueForUseRustfmt(): Promise<void> {
        const yesChoice = 'Yes';
        const noChoice = 'No';
        const message = 'Do you want to use rustfmt for formatting?';
        const choice = await window.showInformationMessage(message, yesChoice, noChoice);
        switch (choice) {
            case yesChoice:
                this._rlsConfiguration.setUseRustfmt(true);
                break;
            case noChoice:
                this._rlsConfiguration.setUseRustfmt(false);
                break;
        }
    }

    private async handleMissingRustfmt(): Promise<void> {
        const message = 'rustfmt is not installed';
        const installRustfmtChoice = 'Install rustfmt';
        const dontUseRustfmtChoice = 'Don\'t use rustfmt';
        const choice = await window.showInformationMessage(message, installRustfmtChoice, dontUseRustfmtChoice);
        switch (choice) {
            case installRustfmtChoice:
                const result = await OutputChannelProcess.create(
                    this._configuration.getCargoPath(),
                    ['install', 'rustfmt'],
                    undefined,
                    'Installing rustfmt'
                );
                const success = result.success && result.code === 0;
                if (success) {
                    window.showInformationMessage('rustfmt has been installed');
                } else {
                    window.showErrorMessage('rustfmt has not been installed');
                    this._rlsConfiguration.setUseRustfmt(false);
                }
                break;
            case dontUseRustfmtChoice:
                this._rlsConfiguration.setUseRustfmt(false);
                break;
            default:
                this._rlsConfiguration.setUseRustfmt(undefined);
                break;
        }
    }

    /**
     * Handles the case when the user does not have RLS.
     * It tries to install RLS if it is possible
     */
    private async handleMissingRls(): Promise<boolean> {
        async function installComponent(componentName: string, installComponent: () => Promise<boolean>): Promise<boolean> {
            window.showInformationMessage(`${componentName} is being installed. It can take a while`);
            const componentInstalled = await installComponent();
            logger.debug(`${componentName} has been installed= ${componentInstalled} `);
            if (componentInstalled) {
                window.showInformationMessage(`${componentName} has been installed successfully`);
            } else {
                window.showErrorMessage(`${componentName} has not been installed. Check the output channel "Rust Logging"`);
            }
            return componentInstalled;
        }
        const logger = this._logger.createChildLogger('handleMissingRls: ');
        if (!this._rustup) {
            logger.error('this._rustup === undefined; this method should not have been called');
            return false;
        }
        const rustup = this._rustup;
        if (await askPermissionToInstall('RLS')) {
            logger.debug('Permission to install RLS has been granted');
        } else {
            logger.debug('Permission to install RLS has not granted');
            return false;
        }
        if (!this._rustup.isNightlyToolchainInstalled()) {
            logger.debug('The nightly toolchain is not installed');
            await handleMissingNightlyToolchain(logger, rustup);
            if (!rustup.isNightlyToolchainInstalled()) {
                logger.debug('The nightly toolchain is not installed');
                return false;
            }
        }
        if (rustup.canInstallRls()) {
            logger.debug('RLS can be installed');
        } else {
            logger.error('RLS cannot be installed');
            return false;
        }
        const rlsInstalled = await installComponent(
            'RLS',
            async () => { return await rustup.installRls(); }
        );
        if (rlsInstalled) {
            logger.debug('RLS has been installed');
        } else {
            logger.error('RLS has not been installed');
            return false;
        }
        if (this._rustup.isRustAnalysisInstalled()) {
            logger.debug('rust-analysis is installed');
        } else if (this._rustup.canInstallRustAnalysis()) {
            logger.debug('rust-analysis can be installed');
        } else {
            logger.error('rust-analysis cannot be installed');
            return false;
        }
        return await installComponent(
            'rust-analysis',
            async () => { return await rustup.installRustAnalysis(); }
        );
    }
}

export async function activate(ctx: ExtensionContext): Promise<void> {
    const loggingManager = new LoggingManager();
    const logger = loggingManager.getLogger();
    const rustup = await Rustup.create(logger.createChildLogger('Rustup: '));
    const rustSource = await RustSource.create(rustup);
    const configuration = new Configuration(logger.createChildLogger('Configuration: '));
    const rlsConfiguration = await RlsConfiguration.create(rustup, rustSource);
    if (configuration.mode() === undefined) {
        // The current configuration does not contain any specified mode and hence we should try to
        // choose one.
        const mode = await askUserToChooseMode();
        switch (mode) {
            case Mode.Legacy:
                configuration.setMode(Mode.Legacy);
                break;
            case Mode.RLS:
                configuration.setMode(Mode.RLS);
                break;
            case undefined:
                break;
        }
    }
    const currentWorkingDirectoryManager = new CurrentWorkingDirectoryManager();
    const cargoManager = new CargoManager(
        ctx,
        configuration,
        currentWorkingDirectoryManager,
        logger.createChildLogger('Cargo Manager: ')
    );
    addExecutingActionOnSave(ctx, configuration, cargoManager);
    if (configuration.mode() === Mode.RLS) {
        const rlsMode = new RlsMode(
            configuration,
            rlsConfiguration,
            rustup,
            logger.createChildLogger('RlsMode: '),
            ctx
        );
        const started = await rlsMode.start();
        if (started) {
            return;
        }
    }
    // If we got here, then the chosen mode is not RLS
    switch (configuration.mode()) {
        case Mode.Legacy:
        case undefined:
            await runInLegacyMode(
                ctx,
                configuration,
                rustSource,
                rustup,
                currentWorkingDirectoryManager,
                logger
            );
            break;
        case Mode.RLS:
            break;
    }
}

async function runInLegacyMode(
    context: ExtensionContext,
    configuration: Configuration,
    rustSource: RustSource,
    rustup: Rustup | undefined,
    currentWorkingDirectoryManager: CurrentWorkingDirectoryManager,
    logger: RootLogger
): Promise<void> {
    const legacyModeManager = await LegacyModeManager.create(
        context,
        configuration,
        rustSource,
        rustup,
        currentWorkingDirectoryManager,
        logger.createChildLogger('Legacy Mode Manager: ')
    );
    await legacyModeManager.start();
}

function addExecutingActionOnSave(
    context: ExtensionContext,
    configuration: Configuration,
    cargoManager: CargoManager
): void {
    context.subscriptions.push(workspace.onDidSaveTextDocument(document => {
        if (!window.activeTextEditor) {
            return;
        }
        const activeDocument = window.activeTextEditor.document;
        if (document !== activeDocument) {
            return;
        }
        if (document.languageId !== 'rust' || !document.fileName.endsWith('.rs')) {
            return;
        }
        const actionOnSave = configuration.getActionOnSave();
        if (!actionOnSave) {
            return;
        }
        switch (actionOnSave) {
            case 'build':
                cargoManager.executeBuildTask(CommandInvocationReason.ActionOnSave);
                break;
            case 'check':
                cargoManager.executeCheckTask(CommandInvocationReason.ActionOnSave);
                break;
            case 'clippy':
                cargoManager.executeClippyTask(CommandInvocationReason.ActionOnSave);
                break;
            case 'doc':
                cargoManager.executeDocTask(CommandInvocationReason.ActionOnSave);
                break;
            case 'run':
                cargoManager.executeRunTask(CommandInvocationReason.ActionOnSave);
                break;
            case 'test':
                cargoManager.executeTestTask(CommandInvocationReason.ActionOnSave);
                break;
        }
    }));
}
