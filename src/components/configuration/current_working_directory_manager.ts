import { access } from 'fs';

import { dirname, join, sep } from 'path';

import { window, workspace, WorkspaceFolder } from 'vscode';

import findUp = require('find-up');

export class CurrentWorkingDirectoryManager {
    private rememberedCwd: string | undefined;

    public cwd(): Promise<string> {
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

        return this.getCwdFromActiveTextEditor()
            .then(newCwd => {
                this.rememberedCwd = newCwd;

                return newCwd;
            })
            .catch((error: Error) => {
                return this.getPreviousCwd(error);
            })
            .catch((error: Error) => {
                const workspaceFolder = (workspace.workspaceFolders || [])[0];
                return this.checkWorkspaceCanBeUsedAsCwd(workspaceFolder).then(canBeUsed => {
                    if (canBeUsed) {
                        return Promise.resolve(workspaceFolder.uri.fsPath);
                    } else {
                        return Promise.reject(error);
                    }
                });
            });
    }

    private checkWorkspaceCanBeUsedAsCwd(workspaceFolder: WorkspaceFolder): Promise<boolean> {
        if (!workspaceFolder) {
            return Promise.resolve(false);
        }

        const filePath = join(workspaceFolder.uri.fsPath, 'Cargo.toml');

        return this.checkPathExists(filePath);
    }

    private getCwdFromActiveTextEditor(): Promise<string> {
        if (!window.activeTextEditor) {
            return Promise.reject(new Error('No active document'));
        }

        const fileName = window.activeTextEditor.document.fileName;

        const workspaceFolder = (workspace.workspaceFolders || [])
            .find(workspaceFolderTmp =>
                fileName.startsWith(join(workspaceFolderTmp.uri.fsPath, sep)));

        if (!workspaceFolder) {
            return Promise.reject(new Error('Current document not in the workspace'));
        }

        return this.findCargoTomlUpToWorkspace(dirname(fileName));
    }

    private findCargoTomlUpToWorkspace(cwd: string): Promise<string> {
        const opts = { cwd: cwd };

        return findUp('Cargo.toml', opts).then((cargoTomlDirPath: string) => {
            if (!cargoTomlDirPath) {
                return Promise.reject(new Error('Cargo.toml hasn\'t been found'));
            }

            const workspaceFolder = (workspace.workspaceFolders || [])
                .find(workspaceFolderTmp =>
                    cargoTomlDirPath.startsWith(join(workspaceFolderTmp.uri.fsPath, sep)));

            if (!workspaceFolder) {
                return Promise.reject(new Error('Cargo.toml hasn\'t been found within the workspace'));
            }

            return Promise.resolve(dirname(cargoTomlDirPath));
        });
    }

    private getPreviousCwd(error: Error): Promise<string> {
        if (!this.rememberedCwd) {
            return Promise.reject(error);
        }

        const pathToCargoTomlInPreviousCwd = join(this.rememberedCwd, 'Cargo.toml');

        return this.checkPathExists(pathToCargoTomlInPreviousCwd).then<string>(exists => {
            if (exists) {
                return Promise.resolve(this.rememberedCwd!);
            } else {
                return Promise.reject(error);
            }
        });
    }

    private checkPathExists(path: string): Promise<boolean> {
        return new Promise(resolve => {
            access(path, e => {
                // A path exists if there is no error
                const pathExists = !e;

                resolve(pathExists);
            });
        });
    }
}
