import { Ecosystem } from '../types';
export interface ParsedDependency {
    packageName: string;
    version: string;
    line: number;
}
export declare function detectEcosystem(filename: string): Ecosystem | null;
export declare function parseDependencyFile(diffContent: string, filename: string, ecosystem: Ecosystem): ParsedDependency[];
//# sourceMappingURL=index.d.ts.map