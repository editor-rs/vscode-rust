import cp = require('child_process');
import * as vscode from 'vscode';
import { Version } from '../utils';

class VersionStatusBarItem {
    private statusBarItem: vscode.StatusBarItem;

    constructor(priority: number) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, priority);
    }

    public showVersion(rustTool: string, version: Version, tooltip?: string | null, command?: string | null): void {
        let statusBarText: string;
        statusBarText = `${rustTool}: ${version.major}.${version.minor}.${version.patch}`;
        switch (version.channel) {
            case 'stable':
                statusBarText += ' S';
                break;
            case 'beta':
                statusBarText += ' B';
                break;
            case 'nightly':
                statusBarText += ' N';
                break;
        }
        this.statusBarItem.text = statusBarText;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.command = command;
        this.statusBarItem.show();
    }
}

export default class RustToolsService {
    private rustupRegExp: RegExp = /rustup (\d+)\.(\d+)\.(\d+) \(.*\)/;
    private cargoRegExp: RegExp = /cargo (\d+)\.(\d+)\.(\d+)-?(stable|nightly)? \(([a-zA-Z0-9]+) .*/;
    private rustcRegExp: RegExp = /rustc (\d+)\.(\d+)\.(\d+)-?(stable|beta|nightly)? \(([a-zA-Z0-9]+) .*/;

    private rustupVersion: Version;
    private cargoVersion: Version;
    private rustcVersion: Version;

    private rustupStatusBar: VersionStatusBarItem;
    private cargoStatusBar: VersionStatusBarItem;
    private rustcStatusBar: VersionStatusBarItem;

    constructor() {
        this.rustupStatusBar = new VersionStatusBarItem(0);
        this.cargoStatusBar = new VersionStatusBarItem(1);
        this.rustcStatusBar = new VersionStatusBarItem(2);
    }

    private getRustUpVersion(): Promise<Version> {
        return new Promise<Version>((resolve) => {
            cp.execFile('rustup', ['--version'], {}, (err, stdout) => {
                let matches = this.rustupRegExp.exec(stdout);
                if (matches) {
                    this.rustupVersion = {
                        major: parseInt(matches[1]),
                        minor: parseInt(matches[2]),
                        patch: parseInt(matches[3])
                    };
                    return resolve(this.rustupVersion);
                } else {
                    return Promise.resolve(null);
                }
            });
        });
    }

    private getCargoVersion(): Promise<Version> {
        return new Promise<Version>((resolve) => {
            cp.execFile('cargo', ['--version'], {}, (err, stdout) => {
                let matches = this.cargoRegExp.exec(stdout);
                if (matches) {
                    this.cargoVersion = {
                        major: parseInt(matches[1]),
                        minor: parseInt(matches[2]),
                        patch: parseInt(matches[3]),
                        channel: matches[4]
                    };
                    return resolve(this.cargoVersion);
                } else {
                    return Promise.resolve(null);
                }
            });
        });
    }

    private getRustcVersion(): Promise<Version> {
        return new Promise<Version>((resolve) => {
            cp.execFile('rustc', ['--version'], {}, (err, stdout) => {
                let matches = this.rustcRegExp.exec(stdout);
                if (matches) {
                    this.rustcVersion = {
                        major: parseInt(matches[1]),
                        minor: parseInt(matches[2]),
                        patch: parseInt(matches[3]),
                        channel: matches[4]
                    };
                    return resolve(this.rustcVersion);
                } else {
                    return Promise.resolve(null);
                }
            });
        });
    }

    public showToolsStatusBar(): void {
        this.getRustUpVersion().then((rustupv) => {
            this.rustupStatusBar.showVersion('Rustup', rustupv);
        });

        this.getCargoVersion().then((cargov) => {
            this.cargoStatusBar.showVersion('Cargo', cargov);
        });

        this.getRustcVersion().then((rustcv) => {
            this.rustcStatusBar.showVersion('Rustc', rustcv);
        });
    }
}
