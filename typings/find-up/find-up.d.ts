declare module 'find-up' {
	function findUp(filename: string, options?: any): Promise<string>;
	export = findUp;
}
