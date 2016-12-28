import vscode = require('vscode');
import findUp = require('find-up');
import * as cp from 'child_process';
import * as path from 'path';

export default class PathService {
    public static getRustcSysroot(): Thenable<string> {
        const options: cp.SpawnOptions = { cwd: process.cwd() };
        const spawnedProcess = cp.spawn('rustc', ['--print', 'sysroot'], options);
        return new Promise((resolve, reject) => {
            spawnedProcess.on('exit', code => {
                if (code === 0) {
                    const sysroot = spawnedProcess.stdout.read().toString().trim();
                    resolve(sysroot);
                } else {
                    reject(code);
                }
            });
        });
    }

    public static getRacerPath(): string {
        const racerPath = vscode.workspace.getConfiguration('rust')['racerPath'];
        return racerPath || 'racer';
    }

    public static getRustfmtPath(): string {
        const rusfmtPath = vscode.workspace.getConfiguration('rust')['rustfmtPath'];
        return rusfmtPath || 'rustfmt';
    }

    public static getRustsymPath(): string {
        const rustsymPath = vscode.workspace.getConfiguration('rust')['rustsymPath'];

        return rustsymPath || 'rustsym';
    }

    public static getRustLangSrcPath(): string {
        const rustSrcPath = vscode.workspace.getConfiguration('rust')['rustLangSrcPath'];
        return rustSrcPath || '';
    }

    public static getCargoPath(): string {
        const cargoPath = vscode.workspace.getConfiguration('rust')['cargoPath'];
        return cargoPath || 'cargo';
    }

    public static getCargoHomePath(): string {
        const cargoHomePath = vscode.workspace.getConfiguration('rust')['cargoHomePath'];
        return cargoHomePath || process.env['CARGO_HOME'] || '';
    }

    public static cwd(): Promise<string|Error> {
        if (!vscode.window.activeTextEditor) {
            return Promise.resolve(new Error('No active document'));
        }

        const fileName = vscode.window.activeTextEditor.document.fileName;
        if (!fileName.startsWith(vscode.workspace.rootPath)) {
            return Promise.resolve(new Error('Current document not in the workspace'));
        }
        return findUp('Cargo.toml', {cwd: path.dirname(fileName)}).then((value: string) => {
            if (value === null) {
                return new Error('There is no Cargo.toml near active document');
            } else {
                return path.dirname(value);
            }
        });
    }
}
