import {
    CloseAction,
    ErrorAction,
    ErrorHandler as IErrorHandler,
    LanguageClient,
    LanguageClientOptions as ClientOptions,
    RevealOutputChannelOn,
    ServerOptions
} from 'vscode-languageclient';

class ErrorHandler implements IErrorHandler {
    private onClosed: () => void;

    public constructor(onClosed: () => void) {
        this.onClosed = onClosed;
    }

    public error(): ErrorAction {
        return ErrorAction.Continue;
    }

    public closed(): CloseAction {
        this.onClosed();

        return CloseAction.DoNotRestart;
    }
}

export class Creator {
    private clientOptions: ClientOptions;

    private serverOptions: ServerOptions;

    public constructor(
        executable: string,
        args: string[] | undefined,
        env: any | undefined,
        revealOutputChannelOn: RevealOutputChannelOn,
        onClosed: () => void
    ) {
        this.clientOptions = {
            documentSelector: ['rust'],
            revealOutputChannelOn,
            synchronize: {
                configurationSection: 'languageServerExample'
            },
            errorHandler: new ErrorHandler(onClosed)
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
