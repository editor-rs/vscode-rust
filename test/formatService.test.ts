import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';
import FormatService from '../src/services/formatService';

suite('Format Service', () => {
    let fileTuples = [];

    let testFilesPath = path.join(__dirname, '../../test/formatService');
    let testFiles = fs.readdirSync(testFilesPath);

    for (let file of testFiles) {
        if (file.endsWith('.out.rs')) {
            continue;
        }

        let inFile = path.resolve(testFilesPath, file);
        let outFile = inFile.replace('.in.rs', '.out.rs');
        fileTuples.push([inFile, outFile]);
    }

    let formatService = new FormatService();
    fileTuples.forEach(([inFile, outFile]) => {
        test('should correctly format ' + path.basename(inFile), () => {
            let expectedText = fs.readFileSync(outFile);
            let textDocument: vscode.TextDocument;

            return vscode.workspace.openTextDocument(inFile).then(document => {
                textDocument = document;
                return formatService.provideDocumentFormattingEdits(document);
            }).then(edits => {
                let workspaceEdit = new vscode.WorkspaceEdit();
                workspaceEdit.set(textDocument.uri, edits);
                return vscode.workspace.applyEdit(workspaceEdit);
            }).then(() => {
                assert.equal(textDocument.getText(), expectedText);
            });
        });
    });
});
