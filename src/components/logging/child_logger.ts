import { Logger } from './logger';

export default class ChildLogger extends Logger {
    private parent: Logger;

    public constructor(loggingMessagePrefix: (() => string) | string, parent: Logger) {
        super(loggingMessagePrefix);

        this.parent = parent;
    }

    public createChildLogger(loggingMessagePrefix: (() => string) | string): ChildLogger {
        return new ChildLogger(loggingMessagePrefix, this);
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
