import { LanguageClient, LanguageClientOptions as ClientOptions, RevealOutputChannelOn, ServerOptions } from 'vscode-languageclient';

export class Creator {
    private clientOptions: ClientOptions;

    private serverOptions: ServerOptions;

    public constructor(executable: string, args: string[] | undefined, env: any | undefined, revealOutputChannelOn: RevealOutputChannelOn) {
        this.clientOptions = {
            documentSelector: ['rust'],
            revealOutputChannelOn,
            synchronize: {
                configurationSection: 'languageServerExample'
            }
        };

        this.serverOptions = {
            command: executable,
            args,
            options: {
                env: Object.assign({}, process.env, env ? env : {})
            }
        };
    }

    public create(): LanguageClient {
        return new LanguageClient('Rust Language Server', this.serverOptions, this.clientOptions);
    }
}
