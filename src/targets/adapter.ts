import type { InstalledSkill, SkillPackage } from "../core/types";

/**
 * Adapter interface for a target AI agent (e.g. Claude Code, Gemini, Cursor).
 * Each adapter knows how to install, uninstall, and list skills for its agent.
 */
export interface TargetAdapter {
	/** Unique identifier for this target agent */
	name: string;

	/** Detect whether this target agent is present in the current environment */
	detect(): boolean;

	/** Install a skill package for the given scope */
	install(skill: SkillPackage, scope: "project" | "global"): Promise<void>;

	/** Uninstall a skill by name for the given scope */
	uninstall(skillName: string, scope: "project" | "global"): Promise<void>;

	/** List all skills installed for this target */
	list(): Promise<InstalledSkill[]>;

	/** Return the base directory where skills are installed for the given scope */
	getInstallPath(scope: "project" | "global"): string;
}
