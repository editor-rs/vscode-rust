import { OutputChannel } from 'vscode';

export class OutputChannelWrapper {
    private channel: OutputChannel;

    public constructor(channel: OutputChannel) {
        this.channel = channel;
    }

    public append(message: string): void {
        this.channel.append(message);
    }

    public clear(): void {
        this.channel.clear();
    }

    public show(): void {
        this.channel.show(true);
    }
}
