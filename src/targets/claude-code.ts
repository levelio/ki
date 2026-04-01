import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { InstalledSkill, SkillPackage } from "../core/types";
import { InstallError } from "../utils/errors";
import type { TargetAdapter } from "./adapter";

/** Metadata stored alongside installed skill files */
interface SkillManifest {
	name: string;
	version?: string;
	source: string;
	installedAt: string;
	scope: "project" | "global";
}

const MANIFEST_FILE = ".ki-manifest.json";

/**
 * Adapter for the Claude Code CLI agent.
 *
 * Skills are installed into `.claude/skills/<skill-name>/` (project scope)
 * or `~/.claude/skills/<skill-name>/` (global scope).
 */
export class ClaudeCodeAdapter implements TargetAdapter {
	name = "claude-code" as const;

	private projectRoot: string;
	private home: string;

	constructor(projectRoot?: string, home?: string) {
		this.projectRoot = projectRoot ?? process.cwd();
		this.home = home ?? homedir();
	}

	detect(): boolean {
		return existsSync(join(this.projectRoot, ".claude")) || existsSync(join(this.home, ".claude"));
	}

	async install(skill: SkillPackage, scope: "project" | "global"): Promise<void> {
		const installDir = join(this.getInstallPath(scope), skill.name);

		try {
			mkdirSync(installDir, { recursive: true });

			const isLocal = skill.source.startsWith("local:");

			for (const file of skill.files) {
				const destPath = join(installDir, file.relativePath);
				mkdirSync(dirname(destPath), { recursive: true });

				if (file.isDirectory) {
					mkdirSync(destPath, { recursive: true });
					continue;
				}

				if (isLocal) {
					this.symlinkOrCopy(file.absolutePath, destPath);
				} else {
					copyFileSync(file.absolutePath, destPath);
				}
			}

			// Write manifest for tracking
			const manifest: SkillManifest = {
				name: skill.name,
				version: skill.version,
				source: skill.source,
				installedAt: new Date().toISOString(),
				scope,
			};
			writeFileSync(join(installDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2), "utf-8");
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new InstallError(`Failed to install skill "${skill.name}": ${message}`);
		}
	}

	async uninstall(skillName: string, scope: "project" | "global"): Promise<void> {
		const installDir = join(this.getInstallPath(scope), skillName);
		if (existsSync(installDir)) {
			rmSync(installDir, { recursive: true, force: true });
		}
	}

	async list(): Promise<InstalledSkill[]> {
		const skills: InstalledSkill[] = [];

		// Collect from both scopes
		for (const scope of ["project", "global"] as const) {
			const installPath = this.getInstallPath(scope);
			if (!existsSync(installPath)) continue;

			const entries = readdirSync(installPath, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;

				const manifestPath = join(installPath, entry.name, MANIFEST_FILE);
				if (existsSync(manifestPath)) {
					try {
						const raw = readFileSync(manifestPath, "utf-8");
						const manifest: SkillManifest = JSON.parse(raw);
						skills.push({
							name: manifest.name,
							source: manifest.source,
							installedAt: manifest.installedAt,
							scope: manifest.scope,
						});
					} catch {
						// Manifest corrupted — skip but include basic info
						skills.push({
							name: entry.name,
							source: "unknown",
							installedAt: new Date().toISOString(),
							scope,
						});
					}
				} else {
					// No manifest — derive from directory name
					skills.push({
						name: entry.name,
						source: "unknown",
						installedAt: new Date().toISOString(),
						scope,
					});
				}
			}
		}

		return skills;
	}

	getInstallPath(scope: "project" | "global"): string {
		if (scope === "project") {
			return join(this.projectRoot, ".claude", "skills");
		}
		return join(this.home, ".claude", "skills");
	}

	/**
	 * Create a symlink from src to dest. On Windows, if symlink creation fails,
	 * fall back to copying the file.
	 */
	private symlinkOrCopy(src: string, dest: string): void {
		try {
			symlinkSync(src, dest);
		} catch (err) {
			// Windows or permission issue — fall back to copy
			if (process.platform === "win32") {
				console.warn(`Symlink failed for "${dest}", falling back to copy.`);
				copyFileSync(src, dest);
			} else {
				throw err;
			}
		}
	}
}
