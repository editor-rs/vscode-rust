declare module 'tree-kill' {
	function kill(pid: number, signal?: string, callback?: (err: any) => void): void;
	export = kill;
}
