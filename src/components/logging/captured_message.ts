export enum CapturedMessageSeverity {
    Debug,
    Error,
    Warning
}

export interface CapturedMessage {
    severity: CapturedMessageSeverity;

    message: string;
}
