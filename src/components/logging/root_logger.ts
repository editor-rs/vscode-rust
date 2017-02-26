import ChildLogger from './child_logger';

import { Logger } from './logger';

export const DEBUG_MESSAGE_PREFIX = 'DEBUG: ';

export const ERROR_MESSAGE_PREFIX = 'ERROR: ';

export const WARNING_MESSAGE_PREFIX = 'WARNING: ';

export default class RootLogger extends Logger {
    private logFunction: ((message: string) => void) | undefined;

    public createChildLogger(loggingMessagePrefix: (() => string) | string): ChildLogger {
        return new ChildLogger(loggingMessagePrefix, this);
    }

    public constructor(loggingMessagePrefix: ((() => string) | string)) {
        super(loggingMessagePrefix);

        this.logFunction = undefined;
    }

    public setLogFunction(logFunction: ((message: string) => void) | undefined): void {
        this.logFunction = logFunction;
    }

    protected debugProtected(message: string): void {
        this.log(message, DEBUG_MESSAGE_PREFIX);
    }

    protected errorProtected(message: string): void {
        this.log(message, ERROR_MESSAGE_PREFIX);
    }

    protected warningProtected(message: string): void {
        this.log(message, WARNING_MESSAGE_PREFIX);
    }

    private log(message: string, severityAsString: string): void {
        if (!this.logFunction) {
            return;
        }

        const fullMessage = severityAsString.concat(this.getLoggingMessagePrefix(), message);

        this.logFunction(fullMessage);
    }
}
