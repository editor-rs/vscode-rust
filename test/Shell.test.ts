import * as assert from 'assert';
import { VALUES, VALUE_STRINGS, fromString } from '../src/Shell';

suite('Shell tests', () => {
    suite('fromString', () => {
        test('parses all possible values to expected values', () => {
            assert.deepEqual(VALUE_STRINGS.map(fromString), VALUES);
        });
    });
});
