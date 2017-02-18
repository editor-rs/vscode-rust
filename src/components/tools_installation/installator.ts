import { existsSync } from 'fs';

import * as path from 'path';

import { ExtensionContext, commands, window } from 'vscode';

import { ConfigurationManager } from '../configuration/configuration_manager';

import ChildLogger from '../logging/child_logger';

import MissingToolsStatusBarItem from './missing_tools_status_bar_item';

export default class Installator {
    private configurationManager: ConfigurationManager;

    private logger: ChildLogger;

    private missingToolsStatusBarItem: MissingToolsStatusBarItem;

    private missingTools: string[];

    public constructor(
        context: ExtensionContext,
        configurationManager: ConfigurationManager,
        logger: ChildLogger
    ) {
        this.configurationManager = configurationManager;

        this.logger = logger;

        const installToolsCommandName = 'rust.install_missing_tools';

        this.missingToolsStatusBarItem = new MissingToolsStatusBarItem(context, installToolsCommandName);

        this.missingTools = [];

        commands.registerCommand(installToolsCommandName, () => {
            this.offerToInstallMissingTools();
        });
    }

    public addStatusBarItemIfSomeToolsAreMissing(): void {
        this.getMissingTools();

        if (this.missingTools.length === 0) {
            return;
        }

        this.missingToolsStatusBarItem.show();
    }

    private offerToInstallMissingTools(): void {
        // Plurality is important. :')
        const group = this.missingTools.length > 1 ? 'them' : 'it';

        const message = `You are missing ${this.missingTools.join(', ')}. Would you like to install ${group}?`;

        const option = { title: 'Install' };

        window.showInformationMessage(message, option).then(selection => {
            if (selection !== option) {
                return;
            }

            this.installMissingTools();
        });
    }

    private installMissingTools(): void {
        const terminal = window.createTerminal('Rust tools installation');
        // cargo install tool && cargo install another_tool
        const cargoBinPath = this.configurationManager.getCargoPath();
        const command = this.missingTools.map(tool => `${cargoBinPath} install ${tool}`).join(' && ');

        terminal.sendText(command);
        terminal.show();

        this.missingToolsStatusBarItem.hide();
    }

    private getMissingTools(): void {
        const logger = this.logger.createChildLogger('getMissingTools(): ');

        const pathDirectories: string[] = (process.env.PATH || '').split(path.delimiter);

        logger.debug(`pathDirectories=${JSON.stringify(pathDirectories)}`);

        const tools: { [tool: string]: string } = {
            'racer': this.configurationManager.getRacerPath(),
            'rustfmt': this.configurationManager.getRustfmtPath(),
            'rustsym': this.configurationManager.getRustsymPath()
        };

        logger.debug(`tools=${JSON.stringify(tools)}`);

        const keys = Object.keys(tools);

        const missingTools = keys.map(tool => {
            // Check if the path exists as-is.
            let userPath = tools[tool];
            if (existsSync(userPath)) {
                logger.debug(`${tool}'s path=${userPath}`);

                return undefined;
            }

            // If the extension is running on Windows and no extension was
            // specified (likely because the user didn't configure a custom path),
            // then prefix one for them.
            if (process.platform === 'win32' && path.extname(userPath).length === 0) {
                userPath += '.exe';
            }

            // Check if the tool exists on the PATH
            for (const part of pathDirectories) {
                let binPath = path.join(part, userPath);

                if (existsSync(binPath)) {
                    return undefined;
                }
            }

            // The tool wasn't found, we should install it
            return tool;
        }).filter(tool => tool !== undefined);
        this.missingTools = <string[]>missingTools;

        logger.debug(`this.missingTools = ${JSON.stringify(this.missingTools)}`);
    }
}
