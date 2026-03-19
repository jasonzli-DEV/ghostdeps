export interface ParsedDependency {
    packageName: string;
    version: string;
    line: number;
}
export declare function parsePython(diffContent: string, filename: string): ParsedDependency[];
//# sourceMappingURL=python.d.ts.map