/** A resolved download location from a Resolver */
export interface ResolvedLocation {
	type: string;
	url: string;
	ref?: string;
	path?: string;
}

/** A skill package ready for installation */
export interface SkillPackage {
	name: string;
	version?: string;
	files: SkillFile[];
	source: string;
	postinstall?: string;
	preuninstall?: string;
}

/** A single file in a skill package */
export interface SkillFile {
	relativePath: string;
	absolutePath: string;
	isDirectory: boolean;
}

/** An installed skill tracked by a TargetAdapter */
export interface InstalledSkill {
	name: string;
	source: string;
	installedAt: string;
	scope: "project" | "global";
}

/** The .ki.json config file shape */
export interface KiConfig {
	$schema?: string;
	skills: Record<string, string>;
}

/** Parsed source specification */
export interface SourceSpec {
	type: "github" | "local" | "registry" | "http" | "marketplace";
	raw: string;
	owner?: string;
	repo?: string;
	ref?: string;
	path?: string;
}

export function parseSourceSpec(input: string): SourceSpec {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new Error("Invalid source spec: empty string");
	}

	// github:user/repo[@ref][:path]
	if (trimmed.startsWith("github:")) {
		const body = trimmed.slice(7);
		const pathParts = body.split(":");
		const repoPart = pathParts[0];
		const path = pathParts[1] ?? "";

		const [ownerRepo, ref] = repoPart.split("@");
		const [owner, repo] = ownerRepo.split("/");

		if (!owner || !repo) {
			throw new Error(`Invalid source spec: ${trimmed}`);
		}

		return { type: "github", raw: trimmed, owner, repo, ref: ref ?? "HEAD", path };
	}

	// local:path
	if (trimmed.startsWith("local:")) {
		return { type: "local", raw: trimmed.slice(6) };
	}

	// registry:name[@version]
	if (trimmed.startsWith("registry:")) {
		return { type: "registry", raw: trimmed.slice(9) };
	}

	// http(s):url
	if (trimmed.startsWith("http:") || trimmed.startsWith("https:")) {
		return { type: "http", raw: trimmed };
	}

	// marketplace:plugin@marketplace
	if (trimmed.startsWith("marketplace:")) {
		return { type: "marketplace", raw: trimmed.slice(12) };
	}

	// bare name → registry fallback
	return { type: "registry", raw: trimmed };
}
