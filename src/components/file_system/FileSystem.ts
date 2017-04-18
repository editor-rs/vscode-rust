import { access } from 'fs';

/**
 * Code related to file system
 */
export class FileSystem {
    /**
     * Checks if there is a file or a directory at a specified path
     * @param path a path to check
     * @return true if there is a file or a directory otherwise false
     */
    public static doesFileOrDirectoryExists(path: string): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            access(path, err => {
                const pathExists = !err;

                resolve(pathExists);
            });
        });
    }
}
