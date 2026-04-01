import type { ResolvedLocation } from "../core/types.js";

export interface Resolver {
	type: string;
	resolve(spec: string): Promise<ResolvedLocation>;
}
