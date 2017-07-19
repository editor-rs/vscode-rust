import { CapturedMessage, CapturedMessageSeverity } from './captured_message';
import { ILogger } from './ILogger';

export abstract class Logger implements ILogger {
    private loggingMessagePrefix: (() => string) | string;

    private messageCaptureEnabled: boolean;

    private capturedMessages: CapturedMessage[];

    public abstract createChildLogger(loggingMessagePrefix: (() => string) | string): ILogger;

    public debug(message: string): void {
        const log = this.debugProtected.bind(this);

        this.addMessageToCapturedMessagesOrLog(message, CapturedMessageSeverity.Debug, log);
    }

    public error(message: string): void {
        const log = this.errorProtected.bind(this);

        this.addMessageToCapturedMessagesOrLog(message, CapturedMessageSeverity.Error, log);
    }

    public warning(message: string): void {
        const log = this.warningProtected.bind(this);

        this.addMessageToCapturedMessagesOrLog(message, CapturedMessageSeverity.Warning, log);
    }

    public startMessageCapture(): void {
        this.messageCaptureEnabled = true;
    }

    public takeCapturedMessages(): CapturedMessage[] {
        const messages = this.capturedMessages;

        this.capturedMessages = [];

        return messages;
    }

    public stopMessageCaptureAndReleaseCapturedMessages(): void {
        this.messageCaptureEnabled = false;

        const messages = this.takeCapturedMessages();

        for (const message of messages) {
            switch (message.severity) {
                case CapturedMessageSeverity.Debug:
                    this.debug(message.message);
                    break;

                case CapturedMessageSeverity.Error:
                    this.error(message.message);
                    break;

                case CapturedMessageSeverity.Warning:
                    this.warning(message.message);
                    break;

                default:
                    throw new Error(`Unhandled severity=${message.severity}`);
            }
        }
    }

    protected constructor(loggingMessagePrefix: (() => string) | string) {
        this.loggingMessagePrefix = loggingMessagePrefix;

        this.messageCaptureEnabled = false;

        this.capturedMessages = [];
    }

    protected abstract debugProtected(message: string): void;

    protected abstract errorProtected(message: string): void;

    protected abstract warningProtected(message: string): void;

    protected getLoggingMessagePrefix(): string {
        if (typeof this.loggingMessagePrefix === 'string') {
            return this.loggingMessagePrefix;
        }

        return this.loggingMessagePrefix();
    }

    private addMessageToCapturedMessagesOrLog(
        message: string,
        severity: CapturedMessageSeverity,
        log: (message: string) => void
    ): void {
        if (this.messageCaptureEnabled) {
            this.capturedMessages.push({
                severity: severity,
                message: message
            });
        } else {
            log(message);
        }
    }
}
