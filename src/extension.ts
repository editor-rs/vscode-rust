// https://github.com/pwnall/node-open
import open = require('open');

import { ExtensionContext, window, workspace } from 'vscode';

import { CargoManager, CommandInvocationReason } from './components/cargo/cargo_manager';

import { Configuration, Mode } from './components/configuration/Configuration';

import CurrentWorkingDirectoryManager from './components/configuration/current_working_directory_manager';

import { Rustup } from './components/configuration/Rustup';

import { Manager as LanguageClientManager } from './components/language_client/manager';

import LoggingManager from './components/logging/logging_manager';

import RootLogger from './components/logging/root_logger';

import LegacyModeManager from './legacy_mode_manager';

enum RlsInstallDecision {
    DoNotAskAgain,
    Install,
    NotInstall
}

/**
 * Asks the user's permission to install RLS
 * @param logger The logger
 * @return The promise which after resolving contains true if the user agreed otherwise false
 */
async function askPermissionToInstallRls(logger: RootLogger): Promise<RlsInstallDecision> {
    const functionLogger = logger.createChildLogger('askPermissionToInstallRls: ');
    const readAboutRlsChoice = 'Read about RLS';
    const installRlsChoice = 'Install RLS';
    const doNotAskMeAgainChoice = 'Don\'t ask me again';
    // Asking the user if the user wants to install RLS until the user declines or agrees.
    // A user can decide to install RLS, then we install it.
    // A user can decide to read about RLS, then we open a link to the repository of RLS and ask again after
    while (true) {
        const choice: string | undefined = await window.showInformationMessage(
            'You use Rustup, but RLS was not found. RLS provides a good user experience',
            readAboutRlsChoice,
            installRlsChoice,
            doNotAskMeAgainChoice
        );
        functionLogger.debug(`choice=${choice}`);
        switch (choice) {
            case readAboutRlsChoice:
                open('https://github.com/rust-lang-nursery/rls');
                break;
            case installRlsChoice:
                return RlsInstallDecision.Install;
            case doNotAskMeAgainChoice:
                return RlsInstallDecision.DoNotAskAgain;
            default:
                return RlsInstallDecision.NotInstall;
        }
    }
}

/**
 * Asks a user if the user agrees to update Rustup
 * @returns true if a user agreed to update otherwise false
 */
async function askPermissionToUpdateRustup(): Promise<boolean> {
    const message = 'Before installing RLS it would be good to update Rustup. If you decline to update, RLS will not be installed';
    const updateChoice = 'Update';
    const choice = await window.showInformationMessage(message, updateChoice);
    return choice === updateChoice;
}

/**
 * Handles the case when the user does not have RLS.
 * It tries to install RLS if it is possible
 * @param logger The logger to log messages
 * @param configuration The configuration
 */
async function handleMissingRls(logger: RootLogger, configuration: Configuration): Promise<void> {
    const functionLogger = logger.createChildLogger('handleMissingRls: ');
    const rustup = configuration.getRustInstallation();
    if (!(rustup instanceof Rustup)) {
        functionLogger.debug('Rust is either not installed or installed not via Rustup');
        const doNotShowMeAgainChoice = 'Don\'t show me this again';
        const choice: string | undefined = await window.showInformationMessage('You do not use Rustup. Rustup is a preferred way to install Rust and its components', doNotShowMeAgainChoice);
        if (choice === doNotShowMeAgainChoice) {
            configuration.setForceLegacyMode(true);
        }
        return;
    }
    const rlsInstallDecision: RlsInstallDecision = await askPermissionToInstallRls(logger);
    functionLogger.debug(`rlsInstallDecision=${rlsInstallDecision}`);
    switch (rlsInstallDecision) {
        case RlsInstallDecision.DoNotAskAgain:
            configuration.setForceLegacyMode(true);
            return;
        case RlsInstallDecision.Install:
            break;
        case RlsInstallDecision.NotInstall:
            return;
    }
    const permissionToUpdateRustupGranted: boolean = await askPermissionToUpdateRustup();
    functionLogger.debug(`permissionToUpdateRustupGranted=${permissionToUpdateRustupGranted}`);
    if (!permissionToUpdateRustupGranted) {
        return;
    }
    const rustupUpdated: boolean = await rustup.update();
    functionLogger.debug(`rustupUpdated=${rustupUpdated}`);
    if (!rustupUpdated) {
        window.showErrorMessage('Rustup failed to update. Check the output channel "Rust Logging"');
        return;
    }
    async function installComponent(componentName: string, installComponent: () => Promise<boolean>): Promise<boolean> {
        window.showInformationMessage(`${componentName} is being installed. It can take a while`);
        const componentInstalled: boolean = await installComponent();
        functionLogger.debug(`${componentName} has been installed=${componentInstalled}`);
        if (componentInstalled) {
            window.showInformationMessage(`${componentName} has been installed successfully`);
        } else {
            window.showErrorMessage(`${componentName} has not been installed. Check the output channel "Rust Logging"`);
        }
        return componentInstalled;
    }
    const rlsCanBeInstalled: boolean = rustup.canInstallRls();
    functionLogger.debug(`rlsCanBeInstalled=${rlsCanBeInstalled}`);
    if (!rlsCanBeInstalled) {
        return;
    }
    const rlsInstalled: boolean = await installComponent(
        'RLS',
        async () => { return await rustup.installRls(); }
    );
    if (!rlsInstalled) {
        return;
    }
    const rustAnalysisCanBeInstalled: boolean = rustup.canInstallRustAnalysis();
    functionLogger.debug(`rustAnalysisCanBeInstalled=${rustAnalysisCanBeInstalled}`);
    if (!rustAnalysisCanBeInstalled) {
        return;
    }
    await installComponent(
        'rust-analysis',
        async () => { return await rustup.installRustAnalysis(); }
    );
}

export async function activate(ctx: ExtensionContext): Promise<void> {
    const loggingManager = new LoggingManager();
    const logger = loggingManager.getLogger();
    const configuration = await Configuration.create(logger.createChildLogger('Configuration: '));
    if (!configuration.getPathToRlsExecutable() && !configuration.isForcedLegacyMode()) {
        await handleMissingRls(logger, configuration);
    }
    const currentWorkingDirectoryManager = new CurrentWorkingDirectoryManager();
    const cargoManager = new CargoManager(
        ctx,
        configuration,
        currentWorkingDirectoryManager,
        logger.createChildLogger('Cargo Manager: ')
    );
    await chooseModeAndRun(ctx, logger, configuration, currentWorkingDirectoryManager);
    addExecutingActionOnSave(ctx, configuration, cargoManager);
}

/**
 * Starts the extension in RLS mode
 * @param context An extension context to use
 * @param logger A logger to log messages
 * @param configuration A configuration
 * @param pathToRlsExecutable A path to the executable of RLS
 */
function runInRlsMode(
    context: ExtensionContext,
    logger: RootLogger,
    configuration: Configuration,
    rlsPath: string
): void {
    const functionLogger = logger.createChildLogger('runInRlsMode: ');
    functionLogger.debug(`rlsPath=${rlsPath}`);
    const env = configuration.getRlsEnv();
    functionLogger.debug(`env=${JSON.stringify(env)}`);
    const args = configuration.getRlsArgs();
    functionLogger.debug(`args=${JSON.stringify(args)}`);
    const revealOutputChannelOn = configuration.getRlsRevealOutputChannelOn();
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
    currentWorkingDirectoryManager: CurrentWorkingDirectoryManager
): Promise<void> {
    const rls: string | undefined = configuration.getPathToRlsExecutable();
    const isLegacyMode = configuration.isForcedLegacyMode() || !rls;
    if (isLegacyMode) {
        configuration.setMode(Mode.Legacy);
        const legacyModeManager = await LegacyModeManager.create(
            context,
            configuration,
            currentWorkingDirectoryManager,
            logger.createChildLogger('Legacy Mode Manager: ')
        );

        await legacyModeManager.start();
    } else {
        configuration.setMode(Mode.RLS);
        runInRlsMode(context, logger, configuration, <string>rls);
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
