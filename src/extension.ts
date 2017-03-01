import { ExtensionContext, window, workspace } from 'vscode';

import { CargoManager } from './components/cargo/cargo_manager';

import { RlsConfiguration } from './components/configuration/configuration_manager';

import { ConfigurationManager } from './components/configuration/configuration_manager';

import CurrentWorkingDirectoryManager from './components/configuration/current_working_directory_manager';

import { Manager as LanguageClientManager } from './components/language_client/manager';

import LoggingManager from './components/logging/logging_manager';

import LegacyModeManager from './legacy_mode_manager';

export async function activate(ctx: ExtensionContext): Promise<void> {
    const loggingManager = new LoggingManager();

    const logger = loggingManager.getLogger();

    const configurationManager = await ConfigurationManager.create();

    const currentWorkingDirectoryManager = new CurrentWorkingDirectoryManager();

    const rlsConfiguration: RlsConfiguration | undefined = configurationManager.getRlsConfiguration();

    const cargoManager = new CargoManager(
        ctx,
        configurationManager,
        currentWorkingDirectoryManager,
        logger.createChildLogger('Cargo Manager: ')
    );

    if (rlsConfiguration !== undefined) {
        let { executable, args, env, revealOutputChannelOn } = rlsConfiguration;

        if (!env) {
            env = {};
        }

        if (!env.RUST_SRC_PATH) {
            env.RUST_SRC_PATH = configurationManager.getRustSourcePath();
        }

        const languageClientManager = new LanguageClientManager(
            ctx,
            logger.createChildLogger('Language Client Manager: '),
            executable,
            args,
            env,
            revealOutputChannelOn
        );

        languageClientManager.start();
    } else {
        const legacyModeManager = new LegacyModeManager(
            ctx,
            configurationManager,
            currentWorkingDirectoryManager,
            logger.createChildLogger('Legacy Mode Manager: ')
        );

        legacyModeManager.start();
    }

    addExecutingActionOnSave(ctx, configurationManager, cargoManager);
}

function addExecutingActionOnSave(
    context: ExtensionContext,
    configurationManager: ConfigurationManager,
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

        const actionOnSave = configurationManager.getActionOnSave();

        if (!actionOnSave) {
            return;
        }

        switch (actionOnSave) {
            case 'build':
                cargoManager.executeBuildTask();
                break;

            case 'check':
                cargoManager.executeCheckTask();
                break;

            case 'clippy':
                cargoManager.executeClippyTask();
                break;

            case 'run':
                cargoManager.executeRunTask();
                break;

            case 'test':
                cargoManager.executeTestTask();
                break;
        }
    }));
}
