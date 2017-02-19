import { isAbsolute, join } from 'path';

import { Diagnostic, DiagnosticCollection, Uri } from 'vscode';

import { FileDiagnostic } from './file_diagnostic';

/**
 * The path of a diagnostic must be absolute.
 * The function prepends the path of the project to the path of the diagnostic.
 * @param diagnosticPath The path of the diagnostic
 * @param projectPath The path of the project
 */
export function normalizeDiagnosticPath(diagnosticPath: string, projectPath: string): string {
    if (isAbsolute(diagnosticPath)) {
        return diagnosticPath;
    } else {
        return join(projectPath, diagnosticPath);
    }
}

/**
 * Adds the diagnostic to the diagnostics only if the diagnostic isn't in the diagnostics.
 * @param diagnostic The diagnostic to add
 * @param diagnostics The collection of diagnostics to take the diagnostic
 */
export function addUniqueDiagnostic(diagnostic: FileDiagnostic, diagnostics: DiagnosticCollection): void {
    const uri = Uri.file(diagnostic.filePath);

    const fileDiagnostics = diagnostics.get(uri);

    if (fileDiagnostics === undefined) {
        // No diagnostics for the file
        // The diagnostic is unique
        diagnostics.set(uri, [diagnostic.diagnostic]);
    } else if (isUniqueDiagnostic(diagnostic.diagnostic, fileDiagnostics)) {
        const newFileDiagnostics = fileDiagnostics.concat([diagnostic.diagnostic]);
        diagnostics.set(uri, newFileDiagnostics);
    }
}

export function isUniqueDiagnostic(diagnostic: Diagnostic, diagnostics: Diagnostic[]): boolean {
    const foundDiagnostic = diagnostics.find(uniqueDiagnostic => {
        if (!diagnostic.range.isEqual(uniqueDiagnostic.range)) {
            return false;
        }

        if (diagnostic.message !== uniqueDiagnostic.message) {
            return false;
        }

        return true;
    });

    return foundDiagnostic === undefined;
}
