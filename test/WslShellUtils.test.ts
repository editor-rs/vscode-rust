import * as assert from 'assert';
import { correctPath } from '../src/WslShellUtils';

suite('WslShellUtils tests', () => {
    suite('correctPath', () => {
        test('works', () => {
            assert.equal(correctPath('C:\\Directory'), '/mnt/c/Directory');
            assert.equal(correctPath('E:\\Some\\Directory'), '/mnt/e/Some/Directory');
        });
    });
});
