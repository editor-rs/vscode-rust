import { DocumentFilter } from 'vscode';

export default function getDocumentFilter(): DocumentFilter {
    return { language: 'rust', scheme: 'file' };
}
