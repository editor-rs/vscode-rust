import { access } from 'fs';
import * as which from 'which';

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

    /**
     * Looks for a specified executable at paths specified in the environment variable PATH
     * @param executable an executable to look for
     * @return A path to the executable if it has been found otherwise undefined
     */
    public static async findExecutablePath(executable: string): Promise<string | undefined> {
        return new Promise<string | undefined>(resolve => {
            which(executable, (err, path) => {
                if (err) {
                    resolve(undefined);
                } else {
                    resolve(path);
                }
            });
        });
    }
}
