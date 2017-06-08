import { Configuration } from '../configuration/Configuration';

export class UserDefinedArgs {
    public static getBuildArgs(): string[] {
        return UserDefinedArgs.getArgs('buildArgs');
    }

    public static getCheckArgs(): string[] {
        return UserDefinedArgs.getArgs('checkArgs');
    }

    public static getClippyArgs(): string[] {
        return UserDefinedArgs.getArgs('clippyArgs');
    }

    public static getDocArgs(): string[] {
        return UserDefinedArgs.getArgs('docArgs');
    }

    public static getRunArgs(): string[] {
        return UserDefinedArgs.getArgs('runArgs');
    }

    public static getTestArgs(): string[] {
        return UserDefinedArgs.getArgs('testArgs');
    }

    private static getArgs(property: string): string[] {
        const configuration = Configuration.getConfiguration();
        return configuration.get<string[]>(property, []);
    }
}
