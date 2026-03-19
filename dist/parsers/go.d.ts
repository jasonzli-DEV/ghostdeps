export interface ParsedDependency {
    packageName: string;
    version: string;
    line: number;
}
export declare function parseGo(diffContent: string): ParsedDependency[];
//# sourceMappingURL=go.d.ts.map