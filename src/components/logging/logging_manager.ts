import { OutputChannel, window } from 'vscode';
import { RootLogger } from './root_logger';

export class LoggingManager {
    private channel: OutputChannel;

    private logger: RootLogger;

    public constructor() {
        this.channel = window.createOutputChannel('Rust logging');

        this.logger = new RootLogger('');

        this.logger.setLogFunction((message: string) => {
            this.channel.appendLine(message);
        });
    }

    public getLogger(): RootLogger {
        return this.logger;
    }
}
