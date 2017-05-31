import { execFile } from 'child_process';
import { SymbolInformation, window } from 'vscode';
import { Configuration } from '../configuration/Configuration';
import { SymbolInformationParser } from './symbol_information_parser';

export class SymbolSearchManager {
    private configuration: Configuration;
    private symbolInformationParser: SymbolInformationParser;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
        this.symbolInformationParser = new SymbolInformationParser();
    }

    public findSymbolsInDocument(documentFilePath: string): Promise<SymbolInformation[]> {
        return this.findSymbols(['search', '-l', documentFilePath]);
    }

    public findSymbolsInWorkspace(
        workspaceDirPath: string,
        query: string
    ): Promise<SymbolInformation[]> {
        return this.findSymbols(['search', '-g', workspaceDirPath, query]);
    }

    private findSymbols(args: string[]): Promise<SymbolInformation[]> {
        const executable = this.configuration.getRustsymPath();
        const options = { maxBuffer: 1024 * 1024 };
        return new Promise<SymbolInformation[]>((resolve, reject) => {
            execFile(executable, args, options, (err, stdout) => {
                try {
                    if (err && (<any>err).code === 'ENOENT') {
                        window.showInformationMessage('The "rustsym" command is not available. Make sure it is installed.');
                        return resolve([]);
                    }
                    const result = stdout.toString();
                    const symbols = this.symbolInformationParser.parseJson(result);
                    return resolve(symbols);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
