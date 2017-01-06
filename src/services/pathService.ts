import vscode = require('vscode');
import findUp = require('find-up');
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export default class PathService {
    private static previousCwd: string | undefined;

    public static getRustcSysroot(): Promise<string> {
        const options: cp.SpawnOptions = { cwd: process.cwd() };
        const spawnedProcess = cp.spawn('rustc', ['--print', 'sysroot'], options);
        return new Promise((resolve, reject) => {
            spawnedProcess.on('error', () => {
                reject();
            });
            spawnedProcess.on('exit', code => {
                if (code === 0) {
                    const sysroot = spawnedProcess.stdout.read().toString().trim();
                    resolve(sysroot);
                } else {
                    reject();
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

    public static cwd(): Promise<string> {
        // Internal description of the method:
        // Issue: https://github.com/KalitaAlexey/vscode-rust/issues/36
        // The algorithm:
        // * Try finding cwd out of an active text editor
        // * If it succeeds:
        //   * Remember the cwd for later use when for some reasons
        //     a cwd wouldn't be find out of an active text editor
        // * Otherwise:
        //   * Try using a previous cwd
        //   * If there is previous cwd:
        //     * Use it
        //   * Otherwise:
        //     * Try using workspace as cwd

        return PathService.getCwdFromActiveTextEditor()
        .then(newCwd => {
            PathService.previousCwd = newCwd;

            return newCwd;
        })
        .catch((error: Error) => {
            return PathService.getPreviousCwd(error);
        })
        .catch((error: Error) => {
            return PathService.checkWorkspaceCanBeUsedAsCwd().then(canBeUsed => {
                if (canBeUsed) {
                    return Promise.resolve(vscode.workspace.rootPath);
                } else {
                    return Promise.reject(error);
                }
            });
        });
    }

    private static checkWorkspaceCanBeUsedAsCwd(): Promise<boolean> {
        const filePath = path.join(vscode.workspace.rootPath, 'Cargo.toml');

        return checkPathExists(filePath);
    }

    private static getCwdFromActiveTextEditor(): Promise<string> {
        if (!vscode.window.activeTextEditor) {
            return Promise.reject(new Error('No active document'));
        }

        const fileName = vscode.window.activeTextEditor.document.fileName;

        if (!fileName.startsWith(vscode.workspace.rootPath)) {
            return Promise.reject(new Error('Current document not in the workspace'));
        }

        return PathService.findCargoTomlUpToWorkspace(path.dirname(fileName));
    }

    private static findCargoTomlUpToWorkspace(cwd: string): Promise<string> {
        const opts = { cwd: cwd };

        return findUp('Cargo.toml', opts).then((cargoTomlDirPath: string) => {
            if (cargoTomlDirPath === null) {
                return Promise.reject(new Error('Cargo.toml hasn\'t been found'));
            }

            if (!cargoTomlDirPath.startsWith(vscode.workspace.rootPath)) {
                return Promise.reject(new Error('Cargo.toml hasn\'t been found within the workspace'));
            }

            return Promise.resolve(path.dirname(cargoTomlDirPath));
        });
    }

    private static getPreviousCwd(error: Error): Promise<string> {
        if (PathService.previousCwd === undefined) {
            return Promise.reject(error);
        }

        const pathToCargoTomlInPreviousCwd = path.join(PathService.previousCwd, 'Cargo.toml');

        return checkPathExists(pathToCargoTomlInPreviousCwd).then<string>(exists => {
            if (exists) {
                return Promise.resolve(PathService.previousCwd);
            } else {
                return Promise.reject(error);
            }
        });
    }
}

function checkPathExists(path: string): Promise<boolean> {
    return new Promise(resolve => {
        fs.access(path, e => {
            // A path exists if there is no error
            const pathExists = !e;

            resolve(pathExists);
        });
    });
}
