import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SkillFile, SkillPackage } from "../core/types";

// We must import after setting up the environment — the module under test
// reads paths at construction time, so we set up env first in beforeEach.

let testDir: string;
let projectRoot: string;
let fakeHome: string;

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function makeSkillFile(relativePath: string, content: string): SkillFile {
	const absolutePath = join(testDir, "source", relativePath);
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, content);
	return { relativePath, absolutePath, isDirectory: false };
}

function makeDirSkillFile(relativePath: string): SkillFile {
	const absolutePath = join(testDir, "source", relativePath);
	mkdirSync(absolutePath, { recursive: true });
	return { relativePath, absolutePath, isDirectory: true };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe("ClaudeCodeAdapter", () => {
	// We'll dynamically import the module under test in each test case so it
	// picks up the env / fs state we set up in beforeEach.
	let adapter: import("./claude-code").ClaudeCodeAdapter;

	beforeEach(async () => {
		testDir = join(tmpdir(), `ki-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		projectRoot = join(testDir, "project");
		fakeHome = join(testDir, "home");
		mkdirSync(projectRoot, { recursive: true });
		mkdirSync(fakeHome, { recursive: true });

		// Mock os.homedir so the adapter uses our fake home
		const os = await import("node:os");
		mock.module("node:os", () => ({
			...os,
			homedir: () => fakeHome,
		}));

		// Fresh import so constructor picks up the mocked homedir
		const mod = await import("./claude-code");
		adapter = new mod.ClaudeCodeAdapter(projectRoot);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	// ---- name ----
	test("name returns 'claude-code'", () => {
		expect(adapter.name).toBe("claude-code");
	});

	// ---- detect ----
	test("detect returns true when .claude/ exists in project root", () => {
		mkdirSync(join(projectRoot, ".claude"));
		expect(adapter.detect()).toBe(true);
	});

	test("detect returns true when ~/.claude/ exists (no project .claude/)", () => {
		mkdirSync(join(fakeHome, ".claude"));
		expect(adapter.detect()).toBe(true);
	});

	test("detect returns false when no .claude/ exists anywhere", () => {
		expect(adapter.detect()).toBe(false);
	});

	// ---- getInstallPath ----
	test("getInstallPath returns .claude/skills/ for project scope", () => {
		expect(adapter.getInstallPath("project")).toBe(join(projectRoot, ".claude", "skills"));
	});

	test("getInstallPath returns ~/.claude/skills/ for global scope", () => {
		expect(adapter.getInstallPath("global")).toBe(join(fakeHome, ".claude", "skills"));
	});

	// ---- install (copy) ----
	test("install creates files in .claude/skills/ for project scope", async () => {
		const files = [
			makeSkillFile("prompt.md", "# Hello"),
			makeSkillFile("commands/summarize.md", "Summarize this"),
		];

		const skill: SkillPackage = {
			name: "test-skill",
			files,
			source: "github:example/skill",
		};

		await adapter.install(skill, "project");

		const installDir = join(projectRoot, ".claude", "skills", "test-skill");
		expect(existsSync(join(installDir, "prompt.md"))).toBe(true);
		expect(existsSync(join(installDir, "commands", "summarize.md"))).toBe(true);
		expect(readFileSync(join(installDir, "prompt.md"), "utf-8")).toBe("# Hello");
		expect(readFileSync(join(installDir, "commands", "summarize.md"), "utf-8")).toBe(
			"Summarize this",
		);
	});

	// ---- install (symlink for local source) ----
	test("install creates symlinks when source starts with 'local:'", async () => {
		const files = [makeSkillFile("prompt.md", "# Local Skill")];

		const skill: SkillPackage = {
			name: "local-skill",
			files,
			source: "local:/path/to/skill",
		};

		await adapter.install(skill, "project");

		const linkPath = join(projectRoot, ".claude", "skills", "local-skill", "prompt.md");
		expect(existsSync(linkPath)).toBe(true);
		// Should be a symlink
		expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
		expect(readFileSync(linkPath, "utf-8")).toBe("# Local Skill");
	});

	// ---- install (global scope) ----
	test("install works for global scope", async () => {
		const files = [makeSkillFile("skill.md", "Global skill")];
		const skill: SkillPackage = {
			name: "global-skill",
			files,
			source: "github:example/global",
		};

		await adapter.install(skill, "global");

		const installDir = join(fakeHome, ".claude", "skills", "global-skill");
		expect(existsSync(join(installDir, "skill.md"))).toBe(true);
		expect(readFileSync(join(installDir, "skill.md"), "utf-8")).toBe("Global skill");
	});

	// ---- install (creates directories for skill files) ----
	test("install creates parent directories if they don't exist", async () => {
		const files = [makeSkillFile("a/b/c/deep.md", "deep file")];
		const skill: SkillPackage = {
			name: "deep-skill",
			files,
			source: "github:example/deep",
		};

		await adapter.install(skill, "project");

		const path = join(projectRoot, ".claude", "skills", "deep-skill", "a", "b", "c", "deep.md");
		expect(existsSync(path)).toBe(true);
		expect(readFileSync(path, "utf-8")).toBe("deep file");
	});

	// ---- install (directory skill files) ----
	test("install creates directories for isDirectory skill files", async () => {
		const files = [makeDirSkillFile("commands/")];
		const skill: SkillPackage = {
			name: "dir-skill",
			files,
			source: "github:example/dir",
		};

		await adapter.install(skill, "project");

		const dirPath = join(projectRoot, ".claude", "skills", "dir-skill", "commands");
		expect(existsSync(dirPath)).toBe(true);
		// Should be a directory
		expect(lstatSync(dirPath).isDirectory()).toBe(true);
	});

	// ---- uninstall ----
	test("uninstall removes skill files from install dir", async () => {
		const files = [makeSkillFile("prompt.md", "# To Remove")];
		const skill: SkillPackage = {
			name: "remove-me",
			files,
			source: "github:example/remove",
		};

		await adapter.install(skill, "project");
		const installDir = join(projectRoot, ".claude", "skills", "remove-me");
		expect(existsSync(installDir)).toBe(true);

		await adapter.uninstall("remove-me", "project");
		expect(existsSync(installDir)).toBe(false);
	});

	test("uninstall works for global scope", async () => {
		const files = [makeSkillFile("skill.md", "global")];
		const skill: SkillPackage = {
			name: "remove-global",
			files,
			source: "github:example/remove-global",
		};

		await adapter.install(skill, "global");
		const installDir = join(fakeHome, ".claude", "skills", "remove-global");
		expect(existsSync(installDir)).toBe(true);

		await adapter.uninstall("remove-global", "global");
		expect(existsSync(installDir)).toBe(false);
	});

	test("uninstall does not throw when skill is not installed", async () => {
		// Should not throw
		await expect(adapter.uninstall("nonexistent", "project")).resolves.toBeUndefined();
	});

	// ---- list ----
	test("list returns empty array when no skills installed", async () => {
		const skills = await adapter.list();
		expect(skills).toEqual([]);
	});

	test("list returns installed skills with metadata", async () => {
		const files = [makeSkillFile("prompt.md", "# Listed Skill")];
		const skill: SkillPackage = {
			name: "listed-skill",
			files,
			source: "github:example/listed",
		};

		await adapter.install(skill, "project");

		const skills = await adapter.list();
		expect(skills.length).toBeGreaterThanOrEqual(1);

		const found = skills.find((s) => s.name === "listed-skill");
		expect(found).toBeDefined();
		expect(found?.name).toBe("listed-skill");
		expect(found?.scope).toBe("project");
		expect(found?.installedAt).toBeTruthy();
	});

	test("list returns global skills", async () => {
		const files = [makeSkillFile("skill.md", "global list")];
		const skill: SkillPackage = {
			name: "global-listed",
			files,
			source: "github:example/global-listed",
		};

		await adapter.install(skill, "global");

		const skills = await adapter.list();
		const found = skills.find((s) => s.name === "global-listed");
		expect(found).toBeDefined();
		expect(found?.scope).toBe("global");
	});

	// ---- cross-platform symlink fallback ----
	test("install copies files successfully even when symlinks are not needed", async () => {
		// This validates the copy path works; symlink fallback is internal
		// and triggered only on Windows when symlink fails.
		const files = [makeSkillFile("copy.md", "copied content")];
		const skill: SkillPackage = {
			name: "copy-skill",
			files,
			source: "github:example/copy",
		};

		await adapter.install(skill, "project");

		const path = join(projectRoot, ".claude", "skills", "copy-skill", "copy.md");
		expect(existsSync(path)).toBe(true);
		expect(lstatSync(path).isFile()).toBe(true);
		expect(readFileSync(path, "utf-8")).toBe("copied content");
	});

	// ---- metadata file ----
	test("install creates a .ki-manifest.json metadata file", async () => {
		const files = [makeSkillFile("prompt.md", "# Meta")];
		const skill: SkillPackage = {
			name: "meta-skill",
			version: "1.0.0",
			files,
			source: "github:example/meta",
		};

		await adapter.install(skill, "project");

		const manifestPath = join(projectRoot, ".claude", "skills", "meta-skill", ".ki-manifest.json");
		expect(existsSync(manifestPath)).toBe(true);
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		expect(manifest.name).toBe("meta-skill");
		expect(manifest.source).toBe("github:example/meta");
		expect(manifest.installedAt).toBeTruthy();
		expect(manifest.version).toBe("1.0.0");
	});

	test("list reads metadata from .ki-manifest.json", async () => {
		const files = [makeSkillFile("prompt.md", "# Manifest")];
		const skill: SkillPackage = {
			name: "manifest-skill",
			version: "2.0.0",
			files,
			source: "github:example/manifest",
		};

		await adapter.install(skill, "project");
		const skills = await adapter.list();
		const found = skills.find((s) => s.name === "manifest-skill");
		expect(found).toBeDefined();
		expect(found?.source).toBe("github:example/manifest");
		expect(found?.installedAt).toBeTruthy();
	});
});
