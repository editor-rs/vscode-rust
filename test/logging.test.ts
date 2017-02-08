// //
// // Note: This example test is leveraging the Mocha test framework.
// // Please refer to their documentation on https://mochajs.org/ for help.
// //

// // The module 'assert' provides assertion methods from node
// import * as assert from 'assert';
// import {CapturedMessageSeverity, DEBUG_MESSAGE_PREFIX, ERROR_MESSAGE_PREFIX,
//     Logger, RootLogger, WARNING_MESSAGE_PREFIX} from '../src/logging/mod';

// // You can import and use all API from the 'vscode' module
// // as well as import your extension to test it
// // import * as vscode from 'vscode';
// // import * as myExtension from '../src/extension';

// suite('Logging tests', () => {
//     test('Can create multiple root loggers', () => {
//         const loggers = [
//             new RootLogger(''),
//             new RootLogger('')
//         ];

//         assert.equal(loggers.length, 2);
//     });

//     test('Can create child logger', () => {
//         const rootLogger = new RootLogger('ROOT ');

//         const nestedLogger = rootLogger.createChildLogger('CHILD ');

//         assert.ok(nestedLogger);
//     });

//     test('Can create multiple child loggers', () => {
//         const rootLogger = new RootLogger('ROOT ');

//         const nestedLogger1 = rootLogger.createChildLogger('CHILD 1 ');

//         assert.ok(nestedLogger1);

//         const nestedLogger2 = rootLogger.createChildLogger('CHILD 2 ');

//         assert.ok(nestedLogger2);
//     });

//     for (const methodName of ['debug', 'warning', 'error']) {
//         let method: (logger: Logger) => (message: string) => void;
//         let messagePrefix: string;

//         switch (methodName) {
//             case 'debug':
//                 method = (logger: Logger) => { return logger.debug.bind(logger); };
//                 messagePrefix = DEBUG_MESSAGE_PREFIX;
//             break;

//             case 'warning':
//                 method = (logger: Logger) => { return logger.warning.bind(logger); };
//                 messagePrefix = WARNING_MESSAGE_PREFIX;
//             break;

//             case 'error':
//                 method = (logger: Logger) => { return logger.error.bind(logger); };
//                 messagePrefix = ERROR_MESSAGE_PREFIX;
//             break;

//             default:
//                 throw new Error(`Unknown methodName=${methodName}`);
//         }

//         test(`Can call \`${methodName}\` on root logger without set logging function`, () => {
//             const rootLogger = new RootLogger('ROOT ');

//             method(rootLogger)('Some message');
//         });

//         test(`Can call \`${methodName}\` on child logger without set logging function`, () => {
//             const rootLogger = new RootLogger('ROOT ');

//             const childLogger = rootLogger.createChildLogger('CHILD ');

//             method(childLogger)('Some message');
//         });

//         test(`Calling \`${methodName}\` on root logger invokes logging function`, () => {
//             let wasLoggingFunctionCalled = false;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction(() => {
//                 wasLoggingFunctionCalled = true;
//             });

//             method(rootLogger)('Hi');

//             assert.equal(wasLoggingFunctionCalled, true);
//         });

//         test(`Calling \`${methodName}\` on child logger invokes logging function`, () => {
//             let wasLoggingFunctionCalled = false;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction(() => {
//                 wasLoggingFunctionCalled = true;
//             });

//             const childLogger = rootLogger.createChildLogger('CHILD ');
//             method(childLogger)('Hi');

//             assert.equal(wasLoggingFunctionCalled, true);
//         });

//         test(`Calling \`${methodName}\` on root logger invokes logging function ` +
//              'with message prepended by root logger\'s prefix', () => {
//             let loggedMessage: string | undefined = undefined;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction((message: string) => {
//                 loggedMessage = message;
//             });

//             method(rootLogger)('Hi');

//             assert.equal(loggedMessage, `${messagePrefix}ROOT Hi`);
//         });

//         test(`Calling \`${methodName}\` on child logger invokes logging function ` +
//              'with message prepended by root logger\'s prefix and child logger\'s prefix', () => {
//             let loggedMessage: string | undefined = undefined;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction((message: string) => {
//                 loggedMessage = message;
//             });

//             const childLogger = rootLogger.createChildLogger('CHILD ');
//             method(childLogger)('Hi');

//             assert.equal(loggedMessage, `${messagePrefix}ROOT CHILD Hi`);
//         });

//         test(`Calling \`${methodName}\` on nested child logger invokes logging function ` +
//              'with message prepended by root logger\'s prefix and ' +
//              'child logger\'s prefix and nested child logger\'s prefix', () => {
//             let loggedMessage: string | undefined = undefined;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction((message: string) => {
//                 loggedMessage = message;
//             });

//             const childLogger = rootLogger.createChildLogger('CHILD ');

//             const nestedChildLogger = childLogger.createChildLogger('NESTED_CHILD ');
//             method(nestedChildLogger)('Hi');

//             assert.equal(loggedMessage, `${messagePrefix}ROOT CHILD NESTED_CHILD Hi`);
//         });

//         test(`Calling \`${methodName}\` on root logger does not invoke logging function ` +
//              'after resetting logging function', () => {
//             let wasLoggingFunctionCalled = false;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction(() => {
//                 wasLoggingFunctionCalled = true;
//             });

//             rootLogger.setLogFunction(undefined);

//             method(rootLogger)('Hi');

//             assert.equal(wasLoggingFunctionCalled, false);
//         });

//         test(`Calling \`${methodName}\` does not invoke logging function ` +
//              'after calling `startMessageCapture` on root logger', () => {
//             let wasLoggingFunctionCalled = false;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction(() => {
//                 wasLoggingFunctionCalled = true;
//             });

//             rootLogger.startMessageCapture();
//             method(rootLogger)('Hi');

//             assert.equal(wasLoggingFunctionCalled, false);

//             const childLogger = rootLogger.createChildLogger('CHILD ');
//             method(childLogger)('Hi');

//             assert.equal(wasLoggingFunctionCalled, false);
//         });

//         test(`Calling \`${methodName}\` does not invoke logging function ` +
//              'after calling `startMessageCapture` on child logger', () => {
//             let wasLoggingFunctionCalled = false;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction(() => {
//                 wasLoggingFunctionCalled = true;
//             });

//             const childLogger = rootLogger.createChildLogger('CHILD ');

//             childLogger.startMessageCapture();
//             childLogger.debug('Hi');

//             const nestedChildLogger = childLogger.createChildLogger('NESTED_CHILD ');
//             nestedChildLogger.debug('Hi');

//             assert.equal(wasLoggingFunctionCalled, false);
//         });

//         test(`Calling \`${methodName}\` on root logger invokes logging function ` +
//              'after calling `startMessageCapture` on child logger', () => {
//             let wasLoggingFunctionCalled = false;

//             const rootLogger = new RootLogger('ROOT ');

//             rootLogger.setLogFunction(() => {
//                 wasLoggingFunctionCalled = true;
//             });

//             const childLogger = rootLogger.createChildLogger('CHILD ');

//             childLogger.startMessageCapture();

//             rootLogger.debug('Hi');

//             assert.equal(wasLoggingFunctionCalled, true);
//         });
//     }

//     test('Calling `takeCapturedMessages` on root logger returns empty array ' +
//          'if message capture isn\'t started or ' +
//          'no messages captured', () => {
//         const rootLogger = new RootLogger('ROOT ');

//         assert.deepEqual(rootLogger.takeCapturedMessages(), []);

//         rootLogger.startMessageCapture();

//         assert.deepEqual(rootLogger.takeCapturedMessages(), []);
//     });

//     test('Calling `takeCapturedMessages` on child logger returns empty array ' +
//          'if message capture isn\'t started or ' +
//          'no messages captured', () => {
//         const rootLogger = new RootLogger('ROOT ');

//         const childLogger = rootLogger.createChildLogger('CHILD ');

//         assert.deepEqual(childLogger.takeCapturedMessages(), []);

//         rootLogger.startMessageCapture();

//         assert.deepEqual(childLogger.takeCapturedMessages(), []);
//     });

//     test('Calling `takeCapturedMessages` on root logger returns all captured messages ' +
//          'and removes them from that logger', () => {
//         const rootLogger = new RootLogger('ROOT ');

//         rootLogger.startMessageCapture();
//         rootLogger.debug('Hi');
//         rootLogger.error('Hi');
//         rootLogger.warning('Hi');

//         assert.deepStrictEqual(rootLogger.takeCapturedMessages(), [
//             {
//                 severity: CapturedMessageSeverity.Debug,
//                 message: 'Hi'
//             },
//             {
//                 severity: CapturedMessageSeverity.Error,
//                 message: 'Hi'
//             },
//             {
//                 severity: CapturedMessageSeverity.Warning,
//                 message: 'Hi'
//             }
//         ]);

//         assert.deepEqual(rootLogger.takeCapturedMessages(), []);
//     });

//     test('Calling `takeCapturedMessages` on child logger returns all captured messages ' +
//         'and removes them from that logger', () => {
//         const rootLogger = new RootLogger('ROOT ');

//         const childLogger = rootLogger.createChildLogger('CHILD ');

//         childLogger.startMessageCapture();
//         childLogger.debug('Hi');
//         childLogger.error('Hi');
//         childLogger.warning('Hi');

//         assert.deepStrictEqual(childLogger.takeCapturedMessages(), [
//             {
//                 severity: CapturedMessageSeverity.Debug,
//                 message: 'Hi'
//             },
//             {
//                 severity: CapturedMessageSeverity.Error,
//                 message: 'Hi'
//             },
//             {
//                 severity: CapturedMessageSeverity.Warning,
//                 message: 'Hi'
//             }
//         ]);

//         assert.deepEqual(childLogger.takeCapturedMessages(), []);
//     });

//     test('Calling `stopMessageCaptureAndReleaseCapturedMessages` on root logger ' +
//         'invokes logging function for each captured message', () => {
//         const messages: string[] = [];

//         const rootLogger = new RootLogger('ROOT ');

//         rootLogger.setLogFunction((message: string) => {
//             messages.push(message);
//         });

//         rootLogger.startMessageCapture();
//         rootLogger.debug('Hi 1');
//         rootLogger.error('Hi 2');
//         rootLogger.warning('Hi 3');
//         rootLogger.stopMessageCaptureAndReleaseCapturedMessages();

//         assert.deepStrictEqual(messages, [
//             `${DEBUG_MESSAGE_PREFIX}ROOT Hi 1`,
//             `${ERROR_MESSAGE_PREFIX}ROOT Hi 2`,
//             `${WARNING_MESSAGE_PREFIX}ROOT Hi 3`
//         ]);
//     });

//     test('Calling `stopMessageCaptureAndReleaseCapturedMessages` on child logger ' +
//         'invokes logging function for each captured message', () => {
//         const messages: string[] = [];

//         const rootLogger = new RootLogger('ROOT ');

//         rootLogger.setLogFunction((message: string) => {
//             messages.push(message);
//         });

//         const childLogger = rootLogger.createChildLogger('CHILD ');

//         childLogger.startMessageCapture();
//         childLogger.debug('Hi 1');
//         childLogger.error('Hi 2');
//         childLogger.warning('Hi 3');
//         childLogger.stopMessageCaptureAndReleaseCapturedMessages();

//         assert.deepStrictEqual(messages, [
//             `${DEBUG_MESSAGE_PREFIX}ROOT CHILD Hi 1`,
//             `${ERROR_MESSAGE_PREFIX}ROOT CHILD Hi 2`,
//             `${WARNING_MESSAGE_PREFIX}ROOT CHILD Hi 3`
//         ]);
//     });
// });
