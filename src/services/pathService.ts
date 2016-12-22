import vscode = require('vscode');
import findUp = require('find-up');
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export default class PathService {
    private static lastCwd: string;

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

    /**
     * Determines currently opened Rust project root directory. It is assumed that a Rust project
     * should have Cargo.toml file.
     *
     * Used by Cargo commands and by symbol service to determine the context in which they should
     * work.
     *
     * Some details:
     *
     * This procedure is complicated by the fact, that the currently opened VSCode workspace may
     * not be exact Rust project directory, or may even contain several Rust projects.
     *
     * Let's say we have a workspace opened, and it has a directory structure that looks like this:
     * - BigSolution/
     *   - RustProject1/
     *     - Cargo.toml
     *     - main.rs
     *   - RustProject2/
     *     - Cargo.toml
     *     - src/
     *       - someotherfile.sql
     *       - somesource.rs
     *   - TODO.txt
     *
     * If currently active editor is BigSolution/RustProject1/main.rs this function should return
     * BigSolution/RustProject1/
     *
     * If currently active editor is BigSolution/RustProject2/src/someotherfile.sql this function
     * should return BigSolution/RustProject2/
     *
     * If currently active editor is BigSolution/TODO.txt, or there is no currently active editor
     * (window has no editors opened at all), then it is ambiguous which project should be the
     * context of the invoked command. In this case, we return first from the following sequence:
     *
     * 1. Last project directory user has worked with (value that was returned by the last cwd()
     *    call), if there was one, if it still exists and if it still has Cargo.toml file.
     *
     * 2. Workspace root directory, if it contains Cargo.toml file.
     *
     * 3. Error.
     */
    public static cwd(): Promise<string> {
        return tryResolveCwdFromEditor()
            .catch(() => { return tryLastCwd(PathService.lastCwd); })
            .catch(() => { return tryWorkspaceRootProject(); })
            .then((result) => {
                if (result.indexOf(vscode.workspace.rootPath) >= 0) {
                    // Only directories that belong to the current workspace are remembered.
                    // This prevents us from remembering and accidently compiling unrelated
                    // projects (if user opens a file from an outside project by drag & drop).
                    PathService.lastCwd = result;
                }
                return result;
            });
    }
}

function tryResolveCwdFromEditor(): Promise<string> {
    if (!vscode.window.activeTextEditor) {
        return Promise.reject(new Error('No active editor.'));
    }
    const fileName = vscode.window.activeTextEditor.document.fileName;
    return findUp('Cargo.toml', {cwd: path.dirname(fileName)}).then((value: string) => {
        if (value) {
            return path.dirname(value);
        } else {
            throw new Error('No Cargo.toml in any parent directory of the currently active editor.');
        }
    });
}

function tryWorkspaceRootProject(): Promise<string> {
    const rootWSDir = vscode.workspace.rootPath;
    const rootCargo = path.join(rootWSDir, 'Cargo.toml');
    return pathExists(rootCargo).then(rootCargoExists => {
        if (rootCargoExists) {
            return rootWSDir;
        } else {
            throw new Error('No Cargo.toml in workspace root directory.');
        }
    });
}

function tryLastCwd(cwd: string): Promise<string> {
    if (!cwd) {
        throw new Error('No last working directory registered.');
    }
    const lastCwdCargo = path.join(cwd, 'Cargo.toml');
    return pathExists(lastCwdCargo).then(lastCwdCargoExists => {
        if (lastCwdCargoExists) {
            return cwd;
        } else {
            throw new Error('No Cargo.toml in last working directory.');
        }
    });
}

function pathExists(fp: string): Promise<boolean> {
    return new Promise(resolve => {
        fs.access(fp, err => {
            resolve(!err);
        });
    });
}
