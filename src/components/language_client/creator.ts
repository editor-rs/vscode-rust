import { LanguageClient, LanguageClientOptions as ClientOptions, ServerOptions } from 'vscode-languageclient';

export class Creator {
    private clientOptions: ClientOptions;

    private serverOptions: ServerOptions;

    public constructor(executable: string, args?: string[], env?: any) {
        this.clientOptions = {
            documentSelector: ['rust'],
            synchronize: {
                configurationSection: 'languageServerExample'
            }
        };

        this.serverOptions = {
            command: executable,
            args: args,
            options: {
                env: Object.assign({}, process.env, env ? env : {})
            }
        };
    }

    public create(): LanguageClient {
        return new LanguageClient('Rust Language Server', this.serverOptions, this.clientOptions);
    }
}
