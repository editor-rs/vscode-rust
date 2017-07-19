import { Shell } from './Shell';

/**
 * The interface declares methods which should be implemented for any shell providers
 */
export interface IShellProvider {
    getValue(): Promise<Shell | undefined>;
}
