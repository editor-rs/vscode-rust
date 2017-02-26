import * as assert from 'assert';

import { Diagnostic, Range, Uri, languages } from 'vscode';

import { addUniqueDiagnostic, isUniqueDiagnostic, normalizeDiagnosticPath } from '../../../src/components/cargo/diagnostic_utils';

import { FileDiagnostic } from '../../../src/components/cargo/file_diagnostic';

suite('Diagnostic Utils Tests', () => {
    suite('normalizeDiagnosticPath', () => {
        test('It works for a relative path', () => {
            if (process.platform === 'win32') {
                assert.equal(normalizeDiagnosticPath('src\\main.rs', 'C:\\Project'), 'C:\\Project\\src\\main.rs');
            } else {
                assert.equal(normalizeDiagnosticPath('src/main.rs', '/project'), '/project/src/main.rs');
            }
        });

        test('It works for an absolute path', () => {
            if (process.platform === 'win32') {
                assert.equal(normalizeDiagnosticPath('C:\\Library\\src\\lib.rs', 'C:\\Project'), 'C:\\Library\\src\\lib.rs');
            } else {
                assert.equal(normalizeDiagnosticPath('/library/src/lib.rs', '/project'), '/library/src/lib.rs');
            }
        });
    });

    suite('isUniqueDiagnostic', () => {
        test('It returns true for empty diagnostics', () => {
            const result = isUniqueDiagnostic(new Diagnostic(new Range(0, 0, 0, 0), '', undefined), []);

            assert.equal(result, true);
        });

        test('It returns true is the diagnostics do not contain any similar diagnostic', () => {
            const diagnostics = [
                new Diagnostic(new Range(0, 0, 0, 0), '', undefined)
            ];

            const result = isUniqueDiagnostic(new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined), diagnostics);

            assert.equal(result, true);
        });

        test('It returns true is the diagnostics contain a diagnostic with same range, but different message', () => {
            const diagnostics = [
                new Diagnostic(new Range(0, 0, 0, 0), '', undefined)
            ];

            const result = isUniqueDiagnostic(new Diagnostic(new Range(0, 0, 0, 0), 'Hello', undefined), diagnostics);

            assert.equal(result, true);
        });

        test('It returns true is the diagnostics contain a diagnostic with same message, but different range', () => {
            const diagnostics = [
                new Diagnostic(new Range(0, 0, 0, 0), 'Hello', undefined)
            ];

            const result = isUniqueDiagnostic(new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined), diagnostics);

            assert.equal(result, true);
        });

        test('It returns false is the diagnostics contain a diagnostic with the same message and range', () => {
            const diagnostics = [
                new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined)
            ];

            const result = isUniqueDiagnostic(new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined), diagnostics);

            assert.equal(result, false);
        });
    });

    test('addUniqueDiagnostic adds the diagnostic to the empty diagnostics', () => {
        const diagnostic: FileDiagnostic = {
            filePath: '/1',
            diagnostic: new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined)
        };

        const diagnostics = languages.createDiagnosticCollection('rust');

        addUniqueDiagnostic(diagnostic, diagnostics);

        const fileDiagnostics = diagnostics.get(Uri.file('/1'));

        if (!fileDiagnostics) {
            assert.notEqual(fileDiagnostics, undefined);
        } else {
            assert.equal(fileDiagnostics.length, 1);
        }
    });

    suite('addUniqueDiagnostic', () => {
        test('It adds the diagnostic to the diagnostics which do not contain any similar diagnostic', () => {
            const diagnostic: FileDiagnostic = {
                filePath: '/1',
                diagnostic: new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined)
            };

            const diagnostics = languages.createDiagnosticCollection('rust');
            diagnostics.set(Uri.file('/1'), [
                new Diagnostic(new Range(2, 3, 3, 4), 'Hello', undefined),
                new Diagnostic(new Range(1, 2, 3, 4), 'Hell', undefined)
            ]);

            addUniqueDiagnostic(diagnostic, diagnostics);

            const fileDiagnostics = diagnostics.get(Uri.file('/1'));

            if (!fileDiagnostics) {
                assert.notEqual(fileDiagnostics, undefined);
            } else {
                assert.equal(fileDiagnostics.length, 3);
            }
        });

        test('It does not add the diagnostic to the diagnostics which contain any similar diagnostic', () => {
            const diagnostic: FileDiagnostic = {
                filePath: '/1',
                diagnostic: new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined)
            };

            const diagnostics = languages.createDiagnosticCollection('rust');
            diagnostics.set(Uri.file('/1'), [
                new Diagnostic(new Range(1, 2, 3, 4), 'Hello', undefined),
                new Diagnostic(new Range(1, 2, 3, 4), 'Hell', undefined)
            ]);

            addUniqueDiagnostic(diagnostic, diagnostics);

            const fileDiagnostics = diagnostics.get(Uri.file('/1'));

            if (!fileDiagnostics) {
                assert.notEqual(fileDiagnostics, undefined);
            } else {
                assert.equal(fileDiagnostics.length, 2);
            }
        });
    });
});
