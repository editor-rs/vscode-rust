import { DocumentFilter } from 'vscode';

export function getDocumentFilter(): DocumentFilter {
    return { language: 'rust', scheme: 'file' };
}
