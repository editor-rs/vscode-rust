import vscode = require('vscode');

export default class PathService {
    public static getRacerPath(): string {
        const racerPath = vscode.workspace.getConfiguration('rust')['racerPath'];
        return racerPath || 'racer';
    }

    public static getRustfmtPath(): string {
        const rusfmtPath = vscode.workspace.getConfiguration('rust')['rustfmtPath'];
        return rusfmtPath || 'rustfmt';
    }

    public static getRustLangSrcPath(): string {
        const rustSrcPath = vscode.workspace.getConfiguration('rust')['rustLangSrcPath'];
        return rustSrcPath || '';
    }

    public static getCargoPath(): string {
        const cargoPath = vscode.workspace.getConfiguration('rust')['cargoPath'];
        return cargoPath || 'cargo';
    }

    public static getCargoHomePath() :string {
        const cargoHomePath = vscode.workspace.getConfiguration('rust')['cargoHomePath'];
        return cargoHomePath || process.env['CARGO_HOME'];
    }
}
