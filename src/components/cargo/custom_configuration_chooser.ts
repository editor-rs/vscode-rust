import { QuickPickItem, window } from 'vscode';

import { Configuration } from '../configuration/Configuration';

interface CustomConfiguration {
    title: string;

    args: string[];
}

class CustomConfigurationQuickPickItem implements QuickPickItem {
    public label: string;

    public description: string;

    public args: string[];

    public constructor(cfg: CustomConfiguration) {
        this.label = cfg.title;

        this.description = '';

        this.args = cfg.args;
    }
}

export class CustomConfigurationChooser {
    private configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public choose(propertyName: string): Thenable<string[]> {
        const configuration = Configuration.getConfiguration();

        const customConfigurations = configuration.get<CustomConfiguration[]>(propertyName);

        if (!customConfigurations) {
            throw new Error(`No custom configurations for property=${propertyName}`);
        }

        if (customConfigurations.length === 0) {
            window.showErrorMessage('There are no defined custom configurations');

            return Promise.reject(null);
        }

        if (customConfigurations.length === 1) {
            const customConfiguration = customConfigurations[0];

            const args = customConfiguration.args;

            return Promise.resolve(args);
        }

        const quickPickItems = customConfigurations.map(c => new CustomConfigurationQuickPickItem(c));

        return window.showQuickPick(quickPickItems).then(item => {
            if (!item) {
                return Promise.reject(null);
            }

            return Promise.resolve(item.args);
        });
    }
}
