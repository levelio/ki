import type { KiConfig, SkillPackage } from "./types.js";
import { InstallError } from "../utils/errors.js";

export interface EngineDependencies {
	resolveAndFetch: (spec: string) => Promise<SkillPackage>;
	installToTargets: (pkg: SkillPackage, scope: "project") => Promise<void>;
	uninstallFromTargets?: (name: string) => Promise<void>;
}

export interface InstallAllResult {
	installed: Array<{ name: string; source: string }>;
	failed: Array<{ name: string; source: string; error: string }>;
}

export interface InstallSingleResult {
	installed: Array<{ name: string; source: string }>;
	failed: Array<{ name: string; source: string; error: string }>;
	skipped?: boolean;
}

export class InstallEngine {
	private deps: EngineDependencies;

	constructor(deps: EngineDependencies) {
		this.deps = deps;
	}

	async installAll(config: KiConfig): Promise<InstallAllResult> {
		const installed: Array<{ name: string; source: string }> = [];
		const failed: Array<{ name: string; source: string; error: string }> = [];

		for (const [name, source] of Object.entries(config.skills)) {
			try {
				const pkg = await this.deps.resolveAndFetch(source);
				await this.deps.installToTargets(pkg, "project");
				installed.push({ name, source });
			} catch (err) {
				failed.push({ name, source, error: (err as Error).message });
			}
		}

		return { installed, failed };
	}

	async installSingle(
		config: KiConfig,
		name: string,
		source: string,
	): Promise<InstallSingleResult> {
		if (config.skills[name] === source) {
			return { installed: [], failed: [], skipped: true };
		}

		const pkg = await this.deps.resolveAndFetch(source);
		await this.deps.installToTargets(pkg, "project");

		config.skills[name] = source;

		return { installed: [{ name, source }], failed: [] };
	}

	async uninstall(config: KiConfig, name: string): Promise<void> {
		if (!(name in config.skills)) {
			throw new InstallError(`Skill not installed: ${name}`);
		}

		delete config.skills[name];

		if (this.deps.uninstallFromTargets) {
			await this.deps.uninstallFromTargets(name);
		}
	}
}
