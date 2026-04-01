import type { ResolvedLocation } from "../core/types";
import { parseSourceSpec } from "../core/types";
import { ResolveError } from "../utils/errors";
import type { Resolver } from "./resolver";

/**
 * Resolves github: source specs into concrete download locations.
 *
 * Format: `github:owner/repo[@ref][:path]`
 */
export class GitHubResolver implements Resolver {
	readonly type = "github";

	async resolve(spec: string): Promise<ResolvedLocation> {
		let parsed;
		try {
			parsed = parseSourceSpec(spec);
		} catch {
			throw new ResolveError(
				`Invalid GitHub source spec: "${spec}". Expected format: github:owner/repo[@ref][:path]`,
			);
		}

		if (parsed.type !== "github" || !parsed.owner || !parsed.repo) {
			throw new ResolveError(
				`Invalid GitHub source spec: "${spec}". Expected format: github:owner/repo[@ref][:path]`,
			);
		}

		const result: ResolvedLocation = {
			type: "github",
			url: `https://github.com/${parsed.owner}/${parsed.repo}.git`,
			ref: parsed.ref ?? "HEAD",
		};

		if (parsed.path) {
			result.path = parsed.path;
		}

		return result;
	}
}
