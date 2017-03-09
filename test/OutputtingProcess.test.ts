import * as assert from 'assert';

import { OutputtingProcess } from '../src/OutputtingProcess';

suite('OutputtingProcess tests', function (): void {
    test('output contains data from stdout', function (this, done): void {
        const args = ['-e', 'console.log("data")'];

        OutputtingProcess.spawn('node', args).then(function (output): void {
            try {
                assert.equal(output.success, true);

                if (output.success) {
                    assert.equal(output.exitCode, 0);

                    assert.equal(output.stderrData, '');

                    assert.equal(output.stdoutData, 'data\n');

                    done();
                }
            } catch (e) {
                done(e);
            }
        });
    });

    test('output contains data from stderr', function (this, done): void {
        const args = ['-e', 'console.error("data")'];

        OutputtingProcess.spawn('node', args).then(function (output): void {
            try {
                assert.equal(output.success, true);

                if (output.success) {
                    assert.equal(output.exitCode, 0);

                    assert.equal(output.stderrData, 'data\n');

                    assert.equal(output.stdoutData, '');

                    done();
                }
            } catch (e) {
                done(e);
            }
        });
    });

    test('output contains exit code', function (this, done): void {
        const args = ['-e', 'process.exit(1)'];

        OutputtingProcess.spawn('node', args).then(function (output): void {
            try {
                assert.equal(output.success, true);

                if (output.success) {
                    assert.equal(output.exitCode, 1);

                    assert.equal(output.stderrData, '');

                    assert.equal(output.stdoutData, '');

                    done();
                }
            } catch (e) {
                done(e);
            }
        });
    });

    test('handles not existing executable', function (this, done): void {
        OutputtingProcess.spawn('nnnnnnnode').then(function (output): void {
            try {
                assert.equal(output.success, false);

                if (!output.success) {
                    assert.equal(output.error, 'ENOENT');

                    done();
                }
            } catch (e) {
                done(e);
            }
        });
    });
});
