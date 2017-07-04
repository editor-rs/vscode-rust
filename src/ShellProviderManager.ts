import { ILogger } from './components/logging/ILogger';
import { IShellProvider } from './IShellProvider';
import { Shell } from './Shell';
import { NotWindowsShellProvider } from './NotWindowsShellProvider';
import { WindowsShellProvider } from './WindowsShellProvider';

/**
 * The main goal of the class is to provide the current value of the shell
 */
export class ShellProviderManager {
    private _shellProvider: IShellProvider;

    /**
     * Creates a new object which can be used to get the current value of the shell
     * @param logger The logger which is used to create child logger which will be used to log
     * messages
     */
    public constructor(logger: ILogger) {
        if (process.platform === 'win32') {
            this._shellProvider = new WindowsShellProvider(logger);
        } else {
            this._shellProvider = new NotWindowsShellProvider();
        }
    }

    /**
     * Gets the current value of the shell and returns it
     */
    public async getValue(): Promise<Shell | undefined> {
        return await this._shellProvider.getValue();
    }
}
