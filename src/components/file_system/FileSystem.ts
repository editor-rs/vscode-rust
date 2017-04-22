import { access } from 'fs';

import { delimiter, extname, join } from 'path';

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
        if (!process.env.PATH) {
            return undefined;
        }

        // A executable on Windows ends with ".exe".
        // Since this method can be called without the extension we need to add it if it is necessary
        if (process.platform === 'win32' && extname(executable).length === 0) {
            executable += '.exe';
        }

        const paths: string[] = process.env.PATH.split(delimiter);

        for (const path of paths) {
            const possibleExecutablePath = join(path, executable);

            const doesPathExist: boolean = await FileSystem.doesFileOrDirectoryExists(possibleExecutablePath);

            if (doesPathExist) {
                return possibleExecutablePath;
            }
        }

        return undefined;
    }
}
