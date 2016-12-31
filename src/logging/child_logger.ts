import {Logger} from './logger';

export class ChildLogger extends Logger {
    private parent: Logger;

    public createChildLogger(loggingMessagePrefix: (() => string) | string): ChildLogger {
        return new ChildLogger(loggingMessagePrefix, this);
    }

    public constructor(loggingMessagePrefix: (() => string) | string, parent: Logger) {
        super(loggingMessagePrefix);

        this.parent = parent;
    }

    protected debugProtected(message: string): void {
        this.parent.debug(this.getLoggingMessagePrefix().concat(message));
    }

    protected errorProtected(message: string): void {
        this.parent.error(this.getLoggingMessagePrefix().concat(message));
    }

    protected warningProtected(message: string): void {
        this.parent.warning(this.getLoggingMessagePrefix().concat(message));
    }
}
