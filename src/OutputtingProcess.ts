import { SpawnOptions, spawn } from 'child_process';

export interface SuccessOutput {
    success: true;

    stdoutData: string;

    stderrData: string;

    exitCode: number;
}

export interface FailureOutput {
    success: false;

    error: string;
}

export type Output = SuccessOutput | FailureOutput;

/**
 * The class providing an ability to spawn a process and receive content of its both stdout and stderr.
 */
export class OutputtingProcess {
    /**
     * Spawns a new process
     * @param executable an executable to spawn
     * @param args arguments to pass to the spawned process
     * @param options options to use for the spawning
     */
    public static spawn(executable: string, args?: string[], options?: SpawnOptions): Promise<Output> {
        const process = spawn(executable, args, options);

        return new Promise<Output>(resolve => {
            let didStdoutClose = false;

            let didStderrClose = false;

            let stdoutData = '';

            let stderrData = '';

            let errorOccurred = false;

            let didProcessClose = false;

            let exitCode: number | undefined = undefined;

            const onCloseEventOfStream = () => {
                if (!errorOccurred &&
                    didStderrClose &&
                    didStdoutClose &&
                    didProcessClose &&
                    exitCode !== undefined) {
                    resolve({ success: true, stdoutData, stderrData, exitCode });
                }
            };

            const onCloseEventOfProcess = onCloseEventOfStream;

            const onExitEventOfProcess = onCloseEventOfProcess;

            process.stdout.on('data', (chunk: string | Buffer) => {
                if (typeof chunk === 'string') {
                    stdoutData += chunk;
                } else {
                    stdoutData += chunk.toString();
                }
            });

            process.stdout.on('close', () => {
                didStdoutClose = true;

                onCloseEventOfStream();
            });

            process.stderr.on('data', (chunk: string | Buffer) => {
                if (typeof chunk === 'string') {
                    stderrData += chunk;
                } else {
                    stderrData += chunk.toString();
                }
            });

            process.stderr.on('close', () => {
                didStderrClose = true;

                onCloseEventOfStream();
            });

            process.on('error', (error: any) => {
                errorOccurred = true;

                resolve({ success: false, error: error.code });
            });

            process.on('close', () => {
                didProcessClose = true;

                onCloseEventOfProcess();
            });

            process.on('exit', code => {
                exitCode = code;

                onExitEventOfProcess();
            });
        });
    }
}
