export interface ParsedDependency {
    packageName: string;
    version: string;
    line: number;
}
export declare function parseDotnet(diffContent: string, filename: string): ParsedDependency[];
//# sourceMappingURL=dotnet.d.ts.map