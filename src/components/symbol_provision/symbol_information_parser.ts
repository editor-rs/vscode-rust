import { Position, Range, SymbolInformation, SymbolKind, Uri } from 'vscode';

interface RustSymbol {
    path: string;
    name: string;
    container: string;
    kind: string;
    line: number;
}

export class SymbolInformationParser {
    private kinds: { [key: string]: SymbolKind };

    public constructor() {
        this.kinds = {
            'struct': SymbolKind.Class,
            'method': SymbolKind.Method,
            'field': SymbolKind.Field,
            'function': SymbolKind.Function,
            'constant': SymbolKind.Constant,
            'static': SymbolKind.Constant,
            'enum': SymbolKind.Enum,
            // Don't really like this,
            // but this was the best alternative given the absense of SymbolKind.Macro
            'macro': SymbolKind.Function
        };
    }

    public parseJson(json: string): SymbolInformation[] {
        const rustSymbols: RustSymbol[] = JSON.parse(json);

        const symbolInformationList: (SymbolInformation | undefined)[] = rustSymbols.map(rustSymbol => {
            const kind = this.getSymbolKind(rustSymbol.kind);

            if (!kind) {
                return undefined;
            }

            const pos = new Position(rustSymbol.line - 1, 0);

            const range = new Range(pos, pos);

            const uri = Uri.file(rustSymbol.path);

            const symbolInformation = new SymbolInformation(
                rustSymbol.name,
                kind,
                range,
                uri,
                rustSymbol.container
            );

            return symbolInformation;
        }).filter(value => value !== undefined);

        // It is safe to cast because we filtered out `undefined` values
        return <SymbolInformation[]>symbolInformationList;
    }

    private getSymbolKind(kind: string): SymbolKind | undefined {
        if (kind === '') {
            return undefined;
        } else {
            return this.kinds[kind];
        }
    }
}
