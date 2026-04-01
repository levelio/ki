import { parseSourceSpec, type SkillPackage, type ResolvedLocation } from "./types.js";
import { InstallEngine } from "./engine.js";
import { LocalResolver } from "../resolvers/local.js";
import { GitHubResolver } from "../resolvers/github.js";
import { LocalFetcher } from "../fetchers/local.js";
import { GitFetcher } from "../fetchers/git.js";
import { ClaudeCodeAdapter } from "../targets/claude-code.js";
import type { TargetAdapter } from "../targets/adapter.js";
import { ResolveError } from "../utils/errors.js";

const resolvers = {
	local: new LocalResolver(),
	github: new GitHubResolver(),
};

const fetchers = {
	local: new LocalFetcher(),
	git: new GitFetcher(),
};

export function createEngine(projectDir: string, options?: { agent?: string }): InstallEngine {
	const targets: TargetAdapter[] = [new ClaudeCodeAdapter(projectDir)];

	return new InstallEngine({
		resolveAndFetch: async (spec: string): Promise<SkillPackage> => {
			const parsed = parseSourceSpec(spec);
			const resolved = await resolve(parsed.type, spec);
			const pkg = await fetch(resolved);
			pkg.source = spec;
			return pkg;
		},

		installToTargets: async (pkg: SkillPackage, scope: "project" | "global") => {
			const filteredTargets = options?.agent
				? targets.filter((t) => t.name === options.agent)
				: targets.filter((t) => t.detect());

			if (filteredTargets.length === 0 && options?.agent) {
				throw new ResolveError(`Agent not found: ${options.agent}`);
			}

			for (const target of filteredTargets) {
				await target.install(pkg, scope);
			}
		},

		uninstallFromTargets: async (name: string) => {
			for (const target of targets) {
				if (!options?.agent || target.name === options.agent) {
					await target.uninstall(name, "project");
				}
			}
		},
	});
}

async function resolve(type: string, spec: string): Promise<ResolvedLocation> {
	switch (type) {
		case "local":
			return resolvers.local.resolve(spec);
		case "github":
			return resolvers.github.resolve(spec);
		default:
			throw new ResolveError(`Unsupported source type: ${type}`);
	}
}

async function fetch(location: ResolvedLocation): Promise<SkillPackage> {
	switch (location.type) {
		case "local":
			return fetchers.local.fetch(location);
		case "github":
			return fetchers.git.fetch(location);
		default:
			throw new ResolveError(`Unsupported fetch type: ${location.type}`);
	}
}
