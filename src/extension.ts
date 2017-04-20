import { ExtensionContext, window, workspace } from 'vscode';

import { CargoManager, CommandInvocationReason } from './components/cargo/cargo_manager';

import { Configuration } from './components/configuration/Configuration';

import CurrentWorkingDirectoryManager from './components/configuration/current_working_directory_manager';

import { Manager as LanguageClientManager } from './components/language_client/manager';

import LoggingManager from './components/logging/logging_manager';

import RootLogger from './components/logging/root_logger';

import LegacyModeManager from './legacy_mode_manager';

export async function activate(ctx: ExtensionContext): Promise<void> {
    const loggingManager = new LoggingManager();

    const logger = loggingManager.getLogger();

    const configuration = await Configuration.create(logger.createChildLogger('Configuration: '));

    const currentWorkingDirectoryManager = new CurrentWorkingDirectoryManager();

    const cargoManager = new CargoManager(
        ctx,
        configuration,
        currentWorkingDirectoryManager,
        logger.createChildLogger('Cargo Manager: ')
    );

    chooseModeAndRun(ctx, logger, configuration, currentWorkingDirectoryManager);

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

    const env = configuration.getRlsEnv();

    methodLogger.debug(`env=${JSON.stringify(env)}`);

    const args = configuration.getRlsArgs();

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

function chooseModeAndRun(
    context: ExtensionContext,
    logger: RootLogger,
    configuration: Configuration,
    currentWorkingDirectoryManager: CurrentWorkingDirectoryManager
): void {
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

        legacyModeManager.start();
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
