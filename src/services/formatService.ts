import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';

import PathService from './pathService';

const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

interface RustFmtDiff {
    startLine: number;
    newLines: string[];
    removedLines: number;
}

export default class FormatService implements vscode.DocumentFormattingEditProvider {
    private cleanDiffLine(line: string): string {
        if (line.endsWith('\u23CE')) {
            return line.slice(1, -1) + '\n';
        }

        return line.slice(1);
    }

    private stripColorCodes(input: string): string {
        return input.replace(ansiRegex, '');
    }

    private parseDiff(fileToProcess: vscode.Uri, diff: string): vscode.TextEdit[] {
        let patches: RustFmtDiff[] = [];
        let currentPatch: RustFmtDiff;
        let currentFile: vscode.Uri;

        diff = this.stripColorCodes(diff);

        for (let line of diff.split(/\n/)) {
            if (line.startsWith('Diff of')) {
                currentFile = vscode.Uri.file(line.slice('Diff of '.length, -1));
            }

            if (!currentFile) {
                continue;
            }

            if (currentFile.toString() === fileToProcess.toString() + '.fmt') {
                if (line.startsWith('Diff at line')) {
                    if (currentPatch != null) {
                        patches.push(currentPatch);
                    }

                    currentPatch = {
                        startLine: parseInt(line.slice('Diff at line'.length), 10),
                        newLines: [],
                        removedLines: 0
                    };
                } else if (line.startsWith('+')) {
                    currentPatch.newLines.push(this.cleanDiffLine(line));
                } else if (line.startsWith('-')) {
                    currentPatch.removedLines += 1;
                } else if (line.startsWith(' ')) {
                    currentPatch.newLines.push(this.cleanDiffLine(line));
                    currentPatch.removedLines += 1;
                }
            }
        }

        if (currentPatch) {
            patches.push(currentPatch);
        }

        let cummulativeOffset = 0;
        let textEdits = patches.map(patch => {
            let newLines = patch.newLines;
            let removedLines = patch.removedLines;

            let startLine = patch.startLine - 1 + cummulativeOffset;
            let endLine = removedLines === 0 ? startLine : startLine + removedLines - 1;
            let range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

            cummulativeOffset += (removedLines - newLines.length);

            let lastLineIndex = newLines.length - 1;
            newLines[lastLineIndex] = newLines[lastLineIndex].replace('\n', '');

            return vscode.TextEdit.replace(range, newLines.join(''));
        });
        return textEdits;
    }

    public provideDocumentFormattingEdits(document: vscode.TextDocument): Thenable<vscode.TextEdit[]> {
        return new Promise((resolve, reject) => {
            let fileName = document.fileName + '.fmt';
            fs.writeFileSync(fileName, document.getText());

            let args = ['--skip-children', '--write-mode=diff', fileName];
            cp.execFile(PathService.getRustfmtPath(), args, (err, stdout, stderr) => {
                try {
                    if (err && (<any>err).code === 'ENOENT') {
                        vscode.window.showInformationMessage('The "rustfmt" command is not available. Make sure it is installed.');
                        return resolve([]);
                    }
                    if (err || stderr.length) {
                        vscode.window.showWarningMessage('Cannot format due to syntax errors');
                        return resolve([]);
                    }

                    return resolve(this.parseDiff(document.uri, stdout));
                } catch (e) {
                    reject(e);
                } finally {
                    fs.unlinkSync(fileName);
                }
            });
        });
    }
}
