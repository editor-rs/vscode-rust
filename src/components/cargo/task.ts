import { ChildProcess, spawn as spawn_process } from 'child_process';

import kill = require('tree-kill');

import * as readline from 'readline';

import { ConfigurationManager } from '../configuration/configuration_manager';

export type ExitCode = number;

export class Task {
    private configurationManager: ConfigurationManager;

    private args: string[];

    private cwd: string;

    private onStarted?: () => void;

    private onLineReceivedInStderr?: (line: string) => void;

    private onLineReceivedInStdout?: (line: string) => void;

    private process: ChildProcess | undefined;

    private interrupted: boolean;

    public constructor(configurationManager: ConfigurationManager, args: string[], cwd: string) {
        this.configurationManager = configurationManager;

        this.args = args;

        this.cwd = cwd;

        this.onStarted = undefined;

        this.onLineReceivedInStderr = undefined;

        this.onLineReceivedInStdout = undefined;

        this.process = undefined;

        this.interrupted = false;
    }

    public setStarted(onStarted: () => void): void {
        this.onStarted = onStarted;
    }

    public setLineReceivedInStderr(onLineReceivedInStderr: (line: string) => void): void {
        this.onLineReceivedInStderr = onLineReceivedInStderr;
    }

    public setLineReceivedInStdout(onLineReceivedInStdout: (line: string) => void): void {
        this.onLineReceivedInStdout = onLineReceivedInStdout;
    }

    public execute(): Thenable<ExitCode> {
        return new Promise<ExitCode>((resolve, reject) => {
            const cargoPath = this.configurationManager.getCargoPath();

            if (this.onStarted) {
                this.onStarted();
            }

            let env = Object.assign({}, process.env);

            const cargoEnv = this.configurationManager.getCargoEnv();

            if (cargoEnv) {
                env = Object.assign(env, cargoEnv);
            }

            this.process = spawn_process(cargoPath, this.args, { cwd: this.cwd, env });

            if (this.onLineReceivedInStdout) {
                const stdout = readline.createInterface({ input: this.process.stdout });

                stdout.on('line', line => {
                    this.onLineReceivedInStdout(line);
                });
            }

            if (this.onLineReceivedInStderr) {
                const stderr = readline.createInterface({ input: this.process.stderr });

                stderr.on('line', line => {
                    this.onLineReceivedInStderr(line);
                });
            }

            this.process.on('error', error => {
                reject(error);
            });

            this.process.on('exit', code => {
                this.process.removeAllListeners();
                this.process = null;

                if (this.interrupted) {
                    reject();

                    return;
                }

                resolve(code);
            });
        });
    }

    public kill(): Thenable<any> {
        return new Promise(resolve => {
            if (!this.interrupted && this.process) {
                kill(this.process.pid, 'SIGTERM', resolve);

                this.interrupted = true;
            }
        });
    }
}
