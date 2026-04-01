import type { ResolvedLocation, SkillPackage } from "../core/types.js";

export interface Fetcher {
	fetch(location: ResolvedLocation): Promise<SkillPackage>;
	extract?(pkg: SkillPackage, pattern: string): Promise<SkillPackage>;
}
