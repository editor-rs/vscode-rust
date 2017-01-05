import {RootLogger} from '../logging/mod';
import * as vscode from 'vscode';

export default class LoggingManager {
    private channel: vscode.OutputChannel;

    private logger: RootLogger;

    public constructor() {
        this.channel = vscode.window.createOutputChannel('Rust logging');

        this.logger = new RootLogger('');

        this.logger.setLogFunction((message: string) => {
            this.channel.appendLine(message);
        });
    }

    public getLogger(): RootLogger {
        return this.logger;
    }
}
