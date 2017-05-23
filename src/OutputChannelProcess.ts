import { window } from 'vscode';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { Readable } from 'stream';
import { OutputChannel } from 'vscode';

export interface Success {
    success: true;
    code: number;
    stdout: string;
    stderr: string;
}

export interface Error {
    success: false;
}

export interface Options {
    /**
     * The flag indicating whether data from stdout should be captured. By default, the data is
     * not captured. If the data is captured, then it will be given when the process ends
     */
    captureStdout?: boolean;

    /**
     * The flag indicating whether data from stderr should be captured. By default, the data is
     * not captured. If the data is captured, then it will be given when the process ends
     */
    captureStderr?: boolean;
}

export async function create(spawnCommand: string, spawnArgs: string[] | undefined,
    spawnOptions: SpawnOptions | undefined, outputChannelName: string): Promise<Success | Error> {
    if (spawnOptions === undefined) {
        spawnOptions = {};
    }
    spawnOptions.stdio = 'pipe';
    const spawnedProcess = spawn(spawnCommand, spawnArgs, spawnOptions);
    const outputChannel = window.createOutputChannel(outputChannelName);
    outputChannel.show();
    const result = await process(spawnedProcess, outputChannel);
    if (result.success && result.code === 0) {
        outputChannel.hide();
        outputChannel.dispose();
    }
    return result;
}

/**
 * Writes data from the process to the output channel. The function also can accept options
 * @param process The process to write data from. The process should be creates with
 * options.stdio = "pipe"
 * @param outputChannel The output channel to write data to
 * @return The result of processing the process
 */
export function process(process: ChildProcess, outputChannel: OutputChannel, options?: Options
): Promise<Success | Error> {
    const stdout = '';
    const captureStdout = getOption(options, o => o.captureStdout, false);
    subscribeToDataEvent(process.stdout, outputChannel, captureStdout, stdout);
    const stderr = '';
    const captureStderr = getOption(options, o => o.captureStderr, false);
    subscribeToDataEvent(process.stderr, outputChannel, captureStderr, stderr);
    return new Promise<Success | Error>(resolve => {
        const processProcessEnding = (code: number) => {
            resolve({
                success: true,
                code,
                stdout,
                stderr
            });
        };
        // If some error happens, then the "error" and "close" events happen.
        // If the process ends, then the "exit" and "close" events happen.
        // It is known that the order of events is not determined.
        let processExited = false;
        let processClosed = false;
        process.on('error', (error: any) => {
            outputChannel.appendLine(`error: error=${error}`);
            resolve({ success: false });
        });
        process.on('close', (code, signal) => {
            outputChannel.appendLine(`\nclose: code=${code}, signal=${signal}`);
            processClosed = true;
            if (processExited) {
                processProcessEnding(code);
            }
        });
        process.on('exit', (code, signal) => {
            outputChannel.appendLine(`\nexit: code=${code}, signal=${signal}`);
            processExited = true;
            if (processClosed) {
                processProcessEnding(code);
            }
        });
    });
}

function getOption(options: Options | undefined, getOption: (options: Options) => boolean | undefined,
    defaultValue: boolean): boolean {
    if (options === undefined) {
        return defaultValue;
    }
    const option = getOption(options);
    if (option === undefined) {
        return defaultValue;
    }
    return option;
}

function subscribeToDataEvent(readable: Readable, outputChannel: OutputChannel, saveData: boolean, dataStorage: string): void {
    readable.on('data', chunk => {
        const chunkAsString = typeof chunk === 'string' ? chunk : chunk.toString();
        outputChannel.append(chunkAsString);
        if (saveData) {
            dataStorage += chunkAsString;
        }
    });
}
