import { existsSync } from "node:fs";
import path from "node:path";
import type { ResolvedLocation } from "../core/types.js";
import { ResolveError } from "../utils/errors.js";
import type { Resolver } from "./resolver.js";

export class LocalResolver implements Resolver {
	type = "local" as const;

	async resolve(spec: string): Promise<ResolvedLocation> {
		const rawPath = spec.startsWith("local:") ? spec.slice(6) : spec;
		const absolutePath = path.resolve(rawPath);

		if (!existsSync(absolutePath)) {
			throw new ResolveError(`Path not found: ${absolutePath}`);
		}

		return {
			type: "local",
			url: absolutePath,
		};
	}
}
