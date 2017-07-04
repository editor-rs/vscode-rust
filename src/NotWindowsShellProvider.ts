import { IShellProvider } from './IShellProvider';
import { Shell } from './Shell';

/**
 * The main goal of the class is to provide the current value of the shell
 */
export class NotWindowsShellProvider implements IShellProvider {
    public getValue(): Promise<Shell | undefined> {
        // All OS expect Windows use Shell
        return Promise.resolve(Shell.Shell);
    }
}
