export interface ParsedDependency {
    packageName: string;
    version: string;
    line: number;
}
export declare function parseRust(diffContent: string): ParsedDependency[];
//# sourceMappingURL=rust.d.ts.map