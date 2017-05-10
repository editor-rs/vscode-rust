import * as assert from 'assert';

import { Shell, escapeSpaces } from '../src/CommandLine';

suite('CommandLine tests', () => {
    suite('escape_spaces', () => {
        test('does not escape a string if the string has no spaces', () => {
            assert.equal(escapeSpaces('/home/user', Shell.Shell), '/home/user');
            assert.equal(escapeSpaces('C:\\User', Shell.CMD), 'C:\\User');
            assert.equal(escapeSpaces('C:\\User', Shell.PowerShell), 'C:\\User');
        });
        test('escapes spaces', () => {
            assert.equal(escapeSpaces('/home/some user with spaces', Shell.Shell), '\'/home/some user with spaces\'');
            assert.equal(escapeSpaces('C:\\Some user with spaces', Shell.PowerShell), 'C:\\Some` user` with` spaces');
            assert.equal(escapeSpaces('C:\\Some user with spaces', Shell.CMD), '"C:\\Some user with spaces"');
        });
        test('does not escape escaped spaces', () => {
            assert.equal(escapeSpaces('\'/home/some user with spaces\'', Shell.Shell), '\'/home/some user with spaces\'');
            assert.equal(escapeSpaces('C:\\Some` user` with` spaces', Shell.PowerShell), 'C:\\Some` user` with` spaces');
            assert.equal(escapeSpaces('"C:\\Some user with spaces"', Shell.CMD), '"C:\\Some user with spaces"');
        });
    });
});
