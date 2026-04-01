import { describe, expect, test } from "bun:test";
import type { KiConfig, SkillPackage, SkillFile } from "../core/types.js";
import { InstallEngine } from "./engine.js";

function makeSkillPackage(name: string, source: string): SkillPackage {
	return {
		name,
		source,
		files: [
			{
				relativePath: `${name}.md`,
				absolutePath: `/tmp/skills/${name}.md`,
				isDirectory: false,
			},
		],
	};
}

describe("InstallEngine", () => {
	test("installAll returns success for empty skills", async () => {
		const engine = new InstallEngine({
			resolveAndFetch: async () => makeSkillPackage("tdd", "github:user/repo@v1.0"),
			installToTargets: async () => {},
		});
		const result = await engine.installAll({ skills: {} });
		expect(result.installed).toEqual([]);
		expect(result.failed).toEqual([]);
	});

	test("installAll installs all skills from config", async () => {
		const resolved: string[] = [];
		const engine = new InstallEngine({
			resolveAndFetch: async (spec: string) => {
				resolved.push(spec);
				return makeSkillPackage(spec, spec);
			},
			installToTargets: async () => {},
		});

		const result = await engine.installAll({
			skills: {
				tdd: "github:user/repo@v1.0",
				debug: "local:./skills/debug",
			},
		});

		expect(result.installed).toHaveLength(2);
		expect(result.failed).toHaveLength(0);
		expect(resolved).toContain("github:user/repo@v1.0");
		expect(resolved).toContain("local:./skills/debug");
	});

	test("installAll collects failures without stopping", async () => {
		const engine = new InstallEngine({
			resolveAndFetch: async (spec: string) => {
				if (spec.includes("nonexistent")) throw new Error("Failed to resolve bad");
				return makeSkillPackage(spec, spec);
			},
			installToTargets: async () => {},
		});

		const result = await engine.installAll({
			skills: {
				good: "github:user/repo@v1.0",
				bad: "github:nonexistent/repo",
			},
		});

		expect(result.installed).toHaveLength(1);
		expect(result.failed).toHaveLength(1);
		expect(result.failed[0].name).toBe("bad");
		expect(result.failed[0].error).toContain("Failed to resolve bad");
	});

	test("installSingle adds skill to config and installs", async () => {
		const config: KiConfig = { skills: {} };
		const engine = new InstallEngine({
			resolveAndFetch: async () => makeSkillPackage("tdd", "github:user/repo@v1.0"),
			installToTargets: async () => {},
		});

		const result = await engine.installSingle(config, "tdd", "github:user/repo@v1.0");

		expect(result.installed).toHaveLength(1);
		expect(config.skills.tdd).toBe("github:user/repo@v1.0");
	});

	test("installSingle skips already installed with same source", async () => {
		const config: KiConfig = { skills: { tdd: "github:user/repo@v1.0" } };
		const engine = new InstallEngine({
			resolveAndFetch: async () => makeSkillPackage("tdd", "github:user/repo@v1.0"),
			installToTargets: async () => {},
		});

		const result = await engine.installSingle(config, "tdd", "github:user/repo@v1.0");

		expect(result.skipped).toBe(true);
	});

	test("installSingle updates source when different", async () => {
		const config: KiConfig = { skills: { tdd: "github:user/repo@v1.0" } };
		const engine = new InstallEngine({
			resolveAndFetch: async () => makeSkillPackage("tdd", "github:user/repo@v2.0"),
			installToTargets: async () => {},
		});

		const result = await engine.installSingle(config, "tdd", "github:user/repo@v2.0");

		expect(result.installed).toHaveLength(1);
		expect(config.skills.tdd).toBe("github:user/repo@v2.0");
	});

	test("uninstall removes from config", async () => {
		const config: KiConfig = { skills: { tdd: "github:user/repo@v1.0" } };
		const uninstalled: string[] = [];
		const engine = new InstallEngine({
			resolveAndFetch: async () => makeSkillPackage("tdd", ""),
			installToTargets: async () => {},
			uninstallFromTargets: async (name: string) => {
				uninstalled.push(name);
			},
		});

		await engine.uninstall(config, "tdd");
		expect(config.skills.tdd).toBeUndefined();
		expect(uninstalled).toContain("tdd");
	});

	test("uninstall throws when skill not in config", async () => {
		const config: KiConfig = { skills: {} };
		const engine = new InstallEngine({
			resolveAndFetch: async () => makeSkillPackage("", ""),
			installToTargets: async () => {},
		});

		expect(engine.uninstall(config, "nonexistent")).rejects.toThrow("Skill not installed");
	});
});
