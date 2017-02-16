import { Diagnostic, DiagnosticSeverity, Range } from 'vscode';

import { FileDiagnostic } from './file_diagnostic';

interface CompilerMessageSpanText {
    highlight_end: number;
    highlight_start: number;
    text: string;
}

interface CompilerMessageCode {
    code: string;
    explanation: string;
}

interface CompilerMessageSpanExpansion {
    def_site_span: CompilerMessageSpan;
    macro_decl_name: string;
    span: CompilerMessageSpan;
}

interface CompilerMessageSpan {
    byte_end: number;
    byte_start: number;
    column_end: number;
    column_start: number;
    expansion?: CompilerMessageSpanExpansion;
    file_name: string;
    is_primary: boolean;
    label: string;
    line_end: number;
    line_start: number;
    suggested_replacement?: any; // I don't know what type it has
    text: CompilerMessageSpanText[];
}

interface CompilerMessage {
    children: any[]; // I don't know what type it has
    code?: CompilerMessageCode;
    level: string;
    message: string;
    rendered?: any; // I don't know what type it has
    spans: CompilerMessageSpan[];
}

interface CargoMessageTarget {
    kind: string[];
    name: string;
    src_path: string;
}

interface CargoMessageWithCompilerMessage {
    message: CompilerMessage;
    package_id: string;
    reason: 'compiler-message';
    target: CargoMessageTarget;
}

interface CargoMessageWithCompilerArtifact {
    features: any[];
    filenames: string[];
    package_id: string;
    profile: any;
    reason: 'compiler-artifact';
    target: CargoMessageTarget;
}

export class DiagnosticParser {
    /**
     * Parses diagnostics from a line
     * @param line A line to parse
     * @return parsed diagnostics
     */
    public parseLine(line: string): FileDiagnostic[] {
        const cargoMessage: CargoMessageWithCompilerArtifact | CargoMessageWithCompilerMessage =
            JSON.parse(line);

        if (cargoMessage.reason === 'compiler-message') {
            return this.parseCompilerMessage(cargoMessage.message);
        } else {
            return [];
        }
    }

    private parseCompilerMessage(compilerMessage: CompilerMessage): FileDiagnostic[] {
        const spans = compilerMessage.spans;

        if (spans.length === 0) {
            return [];
        }

        // Only add the primary span, as VSCode orders the problem window by the
        // error's range, which causes a lot of confusion if there are duplicate messages.
        let primarySpan = spans.find(span => span.is_primary);

        if (!primarySpan) {
            return [];
        }

        // Following macro expansion to get correct file name and range.
        while (primarySpan.expansion && primarySpan.expansion.span) {
            primarySpan = primarySpan.expansion.span;
        }

        const range = new Range(
            primarySpan.line_start - 1,
            primarySpan.column_start - 1,
            primarySpan.line_end - 1,
            primarySpan.column_end - 1
        );

        let message = compilerMessage.message;

        if (compilerMessage.code) {
            message = `${compilerMessage.code.code}: ${message}`;
        }

        if (primarySpan.label) {
            message += `\n  label: ${primarySpan.label}`;
        }

        message = this.addNotesToMessage(message, compilerMessage.children, 1);

        const diagnostic = new Diagnostic(range, message, this.toSeverity(compilerMessage.level));

        const fileDiagnostic = { filePath: primarySpan.file_name, diagnostic: diagnostic };

        return [fileDiagnostic];
    }

    private toSeverity(severity: string): DiagnosticSeverity {
        switch (severity) {
            case 'warning':
                return DiagnosticSeverity.Warning;

            case 'note':
                return DiagnosticSeverity.Information;

            case 'help':
                return DiagnosticSeverity.Hint;

            default:
                return DiagnosticSeverity.Error;
        }
    }

    private addNotesToMessage(msg: string, children: any[], level: number): string {
        const indentation = '  '.repeat(level);

        for (const child of children) {
            msg += `\n${indentation}${child.level}: ${child.message}`;

            if (child.spans && child.spans.length > 0) {
                msg += ': ';
                const lines = [];

                for (const span of child.spans) {
                    if (!span.file_name || !span.line_start) {
                        continue;
                    }

                    lines.push(`${span.file_name}(${span.line_start})`);
                }

                msg += lines.join(', ');
            }

            if (child.children) {
                msg = this.addNotesToMessage(msg, child.children, level + 1);
            }
        }

        return msg;
    }
}
