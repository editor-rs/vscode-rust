/**
 * Configuration of Rust installed not via Rustup, but via other variant
 */
export class NotRustup {
    /**
     * A path to Rust's installation root.
     * It is what `rustc --print=sysroot` returns
     */
    private rustcSysRoot: string;

    public constructor(rustcSysRoot: string) {
        this.rustcSysRoot = rustcSysRoot;
    }

    /**
     * Returns Rust's installation root
     */
    public getRustcSysRoot(): string {
        return this.rustcSysRoot;
    }
}
