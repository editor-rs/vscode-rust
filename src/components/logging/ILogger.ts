import { CapturedMessage } from './captured_message';

export interface ILogger {
    createChildLogger(loggingMessagePrefix: (() => string) | string): ILogger;
    debug(message: string): void;
    error(message: string): void;
    warning(message: string): void;
    startMessageCapture(): void;
    takeCapturedMessages(): CapturedMessage[];
    stopMessageCaptureAndReleaseCapturedMessages(): void;
}
