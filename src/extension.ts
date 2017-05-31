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

async function handleMissingRlsAndRustupWhenModeIsRls(
    logger: RootLogger,
    configuration: Configuration
): Promise<void> {
    const functionLogger = logger.createChildLogger('handleMissingRlsAndRustupWhenModeIsRls: ');
    functionLogger.debug('enter');
    const message = 'You have chosen RLS mode, but neither RLS nor rustup is installed';
    const switchToLegacyModeChoice = 'Switch to Legacy mode';
    const askMeLaterChoice = 'Ask me later';
    const choice = await window.showErrorMessage(message, switchToLegacyModeChoice, askMeLaterChoice);
    switch (choice) {
        case switchToLegacyModeChoice:
            configuration.setMode(Mode.Legacy);
            break;
        case askMeLaterChoice:
        default:
            configuration.setMode(undefined);
            break;
    }
}

/**
 * Handles the case when the user does not have RLS.
 * It tries to install RLS if it is possible
 * @param logger The logger to log messages
 * @param rustup The rustup
 */
async function handleMissingRls(logger: RootLogger, rustup: Rustup): Promise<boolean> {
    async function installComponent(componentName: string, installComponent: () => Promise<boolean>): Promise<boolean> {
        window.showInformationMessage(`${componentName} is being installed.It can take a while`);
        const componentInstalled = await installComponent();
        functionLogger.debug(`${componentName} has been installed= ${componentInstalled} `);
        if (componentInstalled) {
            window.showInformationMessage(`${componentName} has been installed successfully`);
        } else {
            window.showErrorMessage(`${componentName} has not been installed.Check the output channel "Rust Logging"`);
        }
        return componentInstalled;
    }
    const functionLogger = logger.createChildLogger('handleMissingRls: ');
    if (await askPermissionToInstall('RLS')) {
        functionLogger.debug('Permission to install RLS has been granted');
    } else {
        functionLogger.debug('Permission to install RLS has not granted');
        return false;
    }
    if (!rustup.isNightlyToolchainInstalled()) {
        functionLogger.debug('The nightly toolchain is not installed');
        await handleMissingNightlyToolchain(functionLogger, rustup);
        if (!rustup.isNightlyToolchainInstalled()) {
            functionLogger.debug('The nightly toolchain is not installed');
            return false;
        }
    }
    if (rustup.canInstallRls()) {
        functionLogger.debug('RLS can be installed');
    } else {
        functionLogger.error('RLS cannot be installed');
        return false;
    }
    const rlsInstalled = await installComponent(
        'RLS',
        async () => { return await rustup.installRls(); }
    );
    if (rlsInstalled) {
        functionLogger.debug('RLS has been installed');
    } else {
        functionLogger.error('RLS has not been installed');
        return false;
    }
    if (rustup.isRustAnalysisInstalled()) {
        functionLogger.debug('rust-analysis is installed');
    } else if (rustup.canInstallRustAnalysis()) {
        functionLogger.debug('rust-analysis can be installed');
    } else {
        functionLogger.error('rust-analysis cannot be installed');
        return false;
    }
    return await installComponent(
        'rust-analysis',
        async () => { return await rustup.installRustAnalysis(); }
    );
}

namespace RlsMode {
    export async function handleMissingValueForUseRustfmt(configuration: RlsConfiguration): Promise<void> {
        const yesChoice = 'Yes';
        const noChoice = 'No';
        const message = 'Do you want to use rustfmt for formatting?';
        const choice = await window.showInformationMessage(message, yesChoice, noChoice);
        switch (choice) {
            case yesChoice:
                configuration.setUseRustfmt(true);
                break;
            case noChoice:
                configuration.setUseRustfmt(false);
                break;
        }
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
    if (configuration.mode() === Mode.RLS && !rlsConfiguration.getExecutablePath()) {
        if (rustup) {
            const rlsInstalled = await handleMissingRls(logger, rustup);
            if (!rlsInstalled) {
                configuration.setMode(undefined);
            }
        } else {
            await handleMissingRlsAndRustupWhenModeIsRls(logger, configuration);
        }
    }
    // The chosen mode could be changed at the previous block
    if (configuration.mode() === Mode.RLS) {
        if (rlsConfiguration.getUseRustfmt() === undefined) {
            await RlsMode.handleMissingValueForUseRustfmt(rlsConfiguration);
        }
        // The user may have chosen whether rustfmt should be used
        if (rlsConfiguration.getUseRustfmt()) {
            await FormattingManager.create(ctx, configuration);
        }
    }
    const currentWorkingDirectoryManager = new CurrentWorkingDirectoryManager();
    const cargoManager = new CargoManager(
        ctx,
        configuration,
        currentWorkingDirectoryManager,
        logger.createChildLogger('Cargo Manager: ')
    );
    await chooseModeAndRun(
        ctx,
        logger,
        configuration,
        rustSource,
        rustup,
        currentWorkingDirectoryManager,
        rlsConfiguration
    );
    addExecutingActionOnSave(ctx, configuration, cargoManager);
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

/**
 * Starts the extension in RLS mode
 * @param context An extension context to use
 * @param logger A logger to log messages
 * @param configuration A configuration
 */
function runInRlsMode(
    context: ExtensionContext,
    logger: RootLogger,
    rlsConfiguration: RlsConfiguration
): void {
    const functionLogger = logger.createChildLogger('runInRlsMode: ');
    // This method is called only when RLS's path is defined, so we don't have to check it again
    const rlsPath = <string>rlsConfiguration.getExecutablePath();
    functionLogger.debug(`rlsPath= ${rlsPath} `);
    const env = rlsConfiguration.getEnv();
    functionLogger.debug(`env= ${JSON.stringify(env)} `);
    const args = rlsConfiguration.getArgs();
    functionLogger.debug(`args= ${JSON.stringify(args)} `);
    const revealOutputChannelOn = rlsConfiguration.getRevealOutputChannelOn();
    functionLogger.debug(`revealOutputChannelOn=${revealOutputChannelOn}`);
    const languageClientManager = new LanguageClientManager(
        context,
        logger.createChildLogger('Language Client Manager: '),
        rlsPath,
        args,
        env,
        revealOutputChannelOn
    );
    languageClientManager.initialStart();
}

async function chooseModeAndRun(
    context: ExtensionContext,
    logger: RootLogger,
    configuration: Configuration,
    rustSource: RustSource,
    rustup: Rustup | undefined,
    currentWorkingDirectoryManager: CurrentWorkingDirectoryManager,
    rlsConfiguration: RlsConfiguration
): Promise<void> {
    switch (configuration.mode()) {
        case Mode.Legacy:
        case undefined:
            await runInLegacyMode(
                context,
                configuration,
                rustSource,
                rustup,
                currentWorkingDirectoryManager,
                logger
            );
            break;
        case Mode.RLS:
            runInRlsMode(context, logger, rlsConfiguration);
            break;
    }
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
