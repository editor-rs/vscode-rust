import { Diagnostic } from 'vscode';

export interface FileDiagnostic {
    filePath: string;

    diagnostic: Diagnostic;
}
