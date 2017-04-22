// https://github.com/pwnall/node-open
import open = require('open');

import { ExtensionContext, window, workspace } from 'vscode';

import { CargoManager, CommandInvocationReason } from './components/cargo/cargo_manager';

import { Configuration } from './components/configuration/Configuration';

import CurrentWorkingDirectoryManager from './components/configuration/current_working_directory_manager';

import { NotRustup } from './components/configuration/NotRustup';

import { Rustup } from './components/configuration/Rustup';

import { Manager as LanguageClientManager } from './components/language_client/manager';

import LoggingManager from './components/logging/logging_manager';

import RootLogger from './components/logging/root_logger';

import LegacyModeManager from './legacy_mode_manager';

enum UserDecisionAboutInstallingRlsViaRustup {
    ReadAboutRls,
    InstallRls,
    Decline
}

/**
 * Checks if Rust is installed via Rustup, then asks a user to install it if it is possible
 * @param logger A logger
 * @param configuration A configuration
 */
async function askForInstallingRlsViaRustup(
    logger: RootLogger,
    configuration: Configuration
): Promise<UserDecisionAboutInstallingRlsViaRustup> {
    const methodLogger = logger.createChildLogger('askForInstallingRlsViaRustup: ');

    const rustInstallation: Rustup | NotRustup | undefined = configuration.getRustInstallation();

    if (!(rustInstallation instanceof Rustup)) {
        methodLogger.error('Rust is either not installed or installed not via Rustup. The method should not have been called');

        return UserDecisionAboutInstallingRlsViaRustup.Decline;
    }

    const readAboutRlsChoice = 'Read about RLS';

    const installRlsChoice = 'Install RLS';

    const choice: string | undefined = await window.showInformationMessage(
        'You use Rustup, but RLS was not found. RLS provides a good user experience',
        readAboutRlsChoice,
        installRlsChoice
    );

    switch (choice) {
        case readAboutRlsChoice:
            methodLogger.debug('A user decided to read about RLS');

            return UserDecisionAboutInstallingRlsViaRustup.ReadAboutRls;

        case installRlsChoice:
            methodLogger.debug('A user decided to install RLS');

            return UserDecisionAboutInstallingRlsViaRustup.InstallRls;

        default:
            methodLogger.debug('A user declined');

            return UserDecisionAboutInstallingRlsViaRustup.Decline;
    }
}

/**
 * Asks a user if the user agrees to update Rustup
 * @param updatePurpose A reason to update which is shown to a user
 * @returns true if a user agreed to update otherwise false
 */
async function askUserToUpdateRustup(updatePurpose: string): Promise<boolean> {
    const updateChoice = 'Update';

    const choice = await window.showInformationMessage(updatePurpose, updateChoice);

    return choice === updateChoice;
}

/**
 * Checks if Rustup can install (because older versions of Rustup cannot) and installs it if it Rustup can do it
 * @param logger A logger
 * @param rustup A rustup
 * @returns true if RLS has been installed otherwise false
 */
async function handleUserDecisionToInstallRls(logger: RootLogger, rustup: Rustup): Promise<boolean> {
    const methodLogger = logger.createChildLogger('handleUserDecisionToInstallRls: ');

    const didUserAgreeToUpdateRustup = await askUserToUpdateRustup('Before installing RLS it would be good to update Rustup. If you decline to update, RLS will not be installed');

    if (!didUserAgreeToUpdateRustup) {
        methodLogger.debug('A user declined to update rustup');

        return false;
    }

    methodLogger.debug('A user agreed to update rustup');

    const didRustupUpdateSuccessfully: boolean = await rustup.update();

    if (!didRustupUpdateSuccessfully) {
        methodLogger.error('Rustup failed to update');

        return false;
    }

    methodLogger.debug('Rustup has updated successfully');

    const canRustupInstallRls = await rustup.canInstallRls();

    if (!canRustupInstallRls) {
        methodLogger.error('Rustup cannot install RLS');

        return false;
    }

    methodLogger.debug('Rustup can install RLS');

    return await rustup.installRls();
}

export async function activate(ctx: ExtensionContext): Promise<void> {
    const loggingManager = new LoggingManager();

    const logger = loggingManager.getLogger();

    const configuration = await Configuration.create(logger.createChildLogger('Configuration: '));

    // The following if statement does the following:
    // * It checks if RLS is installed via any way
    //  * If it is, then it stops
    //  * Otherwise it checks if Rust is installed via Rustup
    //   * If it is, then it asks a user if the user wants to install RLS
    //    * If a user agrees to install RLS
    //     * It installs RLS
    //   * Otherwise it shows an error message
    if (!configuration.getPathToRlsExecutable()) {
        const rustInstallation = configuration.getRustInstallation();

        if (rustInstallation instanceof Rustup) {
            // Asking a user if the user wants to install RLS until the user declines it or agrees to install it.
            // A user can decide to install RLS, then we install it.
            // A user can decide to read about RLS, then we open a link to the repository of RLS and ask again after

            let shouldStop = false;

            while (!shouldStop) {
                const userDecision: UserDecisionAboutInstallingRlsViaRustup = await askForInstallingRlsViaRustup(logger, configuration);

                switch (userDecision) {
                    case UserDecisionAboutInstallingRlsViaRustup.Decline:
                        shouldStop = true;

                        break;

                    case UserDecisionAboutInstallingRlsViaRustup.InstallRls: {
                        const isRlsInstalled: boolean = await handleUserDecisionToInstallRls(logger, rustInstallation);

                        if (isRlsInstalled) {
                            await window.showInformationMessage('RLS has been installed successfully');
                        } else {
                            await window.showErrorMessage('RLS has not been installed. Check the output channel "Rust Logging"');
                        }

                        shouldStop = true;

                        break;
                    }

                    case UserDecisionAboutInstallingRlsViaRustup.ReadAboutRls:
                        open('https://github.com/rust-lang-nursery/rls');

                        break;
                }
            }
        } else {
            logger.debug('Rust is either not installed or installed not via Rustup');

            await window.showInformationMessage('You do not use Rustup. Rustup is a preffered way to install Rust and its components');
        }
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
    pathToRlsExecutable: string
): void {
    const methodLogger = logger.createChildLogger('runInRlsMode: ');

    const env = configuration.getRlsEnv() || {};

    methodLogger.debug(`env=${JSON.stringify(env)}`);

    const args = configuration.getRlsArgs() || [];

    methodLogger.debug(`args=${JSON.stringify(args)}`);

    let revealOutputChannelOn = configuration.getRlsRevealOutputChannelOn();

    methodLogger.debug(`revealOutputChannelOn=${revealOutputChannelOn}`);

    const languageClientManager = new LanguageClientManager(
        context,
        logger.createChildLogger('Language Client Manager: '),
        pathToRlsExecutable,
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
    const pathToRlsExecutable = configuration.getPathToRlsExecutable();

    if (pathToRlsExecutable) {
        runInRlsMode(context, logger, configuration, pathToRlsExecutable);
    } else {
        const legacyModeManager = new LegacyModeManager(
            context,
            configuration,
            currentWorkingDirectoryManager,
            logger.createChildLogger('Legacy Mode Manager: ')
        );

        await legacyModeManager.start();
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
