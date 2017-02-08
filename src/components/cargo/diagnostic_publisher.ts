import { join } from 'path';

import { Diagnostic, DiagnosticCollection, Uri, languages } from 'vscode';

import { FileDiagnostic } from './file_diagnostic';

export class DiagnosticPublisher {
    private diagnostics: DiagnosticCollection;

    public constructor() {
        this.diagnostics = languages.createDiagnosticCollection('rust');
    }

    public clearDiagnostics(): void {
        this.diagnostics.clear();
    }

    /**
     * Publishes a diagnostic if the diagnostic wasn't published yet
     */
    public publishDiagnostic(fileDiagnostic: FileDiagnostic, cwd: string): void {
        const diagnostic = fileDiagnostic.diagnostic;
        const filePath = Uri.file(join(cwd, fileDiagnostic.filePath));

        const oneFileDiagnostics = this.diagnostics.get(filePath);

        if (oneFileDiagnostics === undefined) {
            this.diagnostics.set(filePath, [diagnostic]);
        } else if (this.isUniqueDiagnostic(diagnostic, oneFileDiagnostics)) {
            oneFileDiagnostics.push(diagnostic);
        }
    }

    private isUniqueDiagnostic(diagnostic: Diagnostic, diagnostics: Diagnostic[]): boolean {
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
}
