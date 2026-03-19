export interface ParsedDependency {
    packageName: string;
    version: string;
    line: number;
}
export declare function parseNpm(diffContent: string): ParsedDependency[];
//# sourceMappingURL=npm.d.ts.map