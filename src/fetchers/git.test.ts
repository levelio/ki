import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import type { ResolvedLocation } from "../core/types";
import { FetchError } from "../utils/errors";
import { GitFetcher } from "./git";

// Helper to create a temporary directory for test fixtures
function createTempDir(prefix = "ki-git-test-"): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

// Helper to create a mock git repo structure on disk (simulating a cloned repo)
function createMockClonedRepo(baseDir: string, files: Record<string, string>): string {
	for (const [filePath, content] of Object.entries(files)) {
		const fullPath = join(baseDir, filePath);
		const dir = fullPath.substring(0, fullPath.lastIndexOf(sep));
		mkdirSync(dir, { recursive: true });
		writeFileSync(fullPath, content, "utf-8");
	}
	return baseDir;
}

describe("GitFetcher", () => {
	const fetcher = new GitFetcher();
	let tempDirs: string[] = [];

	// Clean up all temp dirs after tests
	afterEach(() => {
		mock.restore();
		for (const dir of tempDirs) {
			if (existsSync(dir)) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
		tempDirs = [];
	});

	function trackDir(dir: string): string {
		tempDirs.push(dir);
		return dir;
	}

	describe("fetch with mock git clone", () => {
		it("clones a repo and returns skill files from skills/ directory", async () => {
			const clonedDir = trackDir(createTempDir("ki-clone-"));
			createMockClonedRepo(clonedDir, {
				"skills/debug.md": "# Debug Skill\nHelps with debugging",
				"skills/code-review.md": "# Code Review Skill",
				"README.md": "# Test Repo",
			});

			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => clonedDir);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/test/repo.git",
				ref: "main",
			};

			const result = await fetcher.fetch(location);

			expect(result.name).toBe("test/repo");
			expect(result.source).toBe("https://github.com/test/repo.git");
			expect(result.files.length).toBe(2);
			expect(result.files.some((f) => f.relativePath.includes("debug.md"))).toBe(true);
			expect(result.files.some((f) => f.relativePath.includes("code-review.md"))).toBe(true);
			// README.md at root should NOT be included when skills/ dir exists
			expect(result.files.some((f) => f.relativePath === "README.md")).toBe(false);
		});

		it("uses ki-skill.json for metadata when present", async () => {
			const clonedDir = trackDir(createTempDir("ki-clone-"));
			createMockClonedRepo(clonedDir, {
				"ki-skill.json": JSON.stringify({
					name: "my-awesome-skill",
					version: "1.2.0",
					postinstall: "echo 'installed'",
					preuninstall: "echo 'uninstalling'",
				}),
				"skills/tool.md": "# Tool",
			});

			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => clonedDir);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/test/skills-pkg.git",
				ref: "v2.0",
			};

			const result = await fetcher.fetch(location);

			expect(result.name).toBe("my-awesome-skill");
			expect(result.version).toBe("1.2.0");
			expect(result.postinstall).toBe("echo 'installed'");
			expect(result.preuninstall).toBe("echo 'uninstalling'");
		});

		it("scopes files to path when ResolvedLocation has path", async () => {
			const clonedDir = trackDir(createTempDir("ki-clone-"));
			createMockClonedRepo(clonedDir, {
				"packages/skill-a/main.md": "# Skill A",
				"packages/skill-a/helper.md": "# Helper",
				"packages/skill-b/main.md": "# Skill B",
				"README.md": "# Root",
			});

			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => clonedDir);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/test/mono.git",
				ref: "main",
				path: "packages/skill-a",
			};

			const result = await fetcher.fetch(location);

			expect(result.name).toBe("test/mono");
			expect(result.files.length).toBe(2);
			// Files should have relative paths starting with the specified path
			expect(result.files.every((f) => f.relativePath.startsWith("packages/skill-a"))).toBe(true);
			// Should NOT include skill-b files
			expect(result.files.some((f) => f.relativePath.includes("skill-b"))).toBe(false);
		});

		it("falls back to root *.md files when no skills/ dir and no ki-skill.json", async () => {
			const clonedDir = trackDir(createTempDir("ki-clone-"));
			createMockClonedRepo(clonedDir, {
				"debug.md": "# Debug Skill",
				"review.md": "# Review Skill",
				"src/index.ts": "export {}",
				"package.json": '{"name": "test"}',
			});

			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => clonedDir);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/test/simple.git",
				ref: "HEAD",
			};

			const result = await fetcher.fetch(location);

			expect(result.files.length).toBe(2);
			expect(result.files.some((f) => f.relativePath === "debug.md")).toBe(true);
			expect(result.files.some((f) => f.relativePath === "review.md")).toBe(true);
			// .ts and .json should not be included
			expect(result.files.some((f) => f.relativePath.endsWith(".ts"))).toBe(false);
			expect(result.files.some((f) => f.relativePath.endsWith(".json"))).toBe(false);
		});

		it("throws FetchError when git clone fails", async () => {
			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => {
				throw new Error("git clone failed: repository not found");
			});

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/nonexistent/repo.git",
				ref: "main",
			};

			expect(fetcher.fetch(location)).rejects.toThrow(FetchError);
		});

		it("derives name from URL owner/repo", async () => {
			const clonedDir = trackDir(createTempDir("ki-clone-"));
			createMockClonedRepo(clonedDir, {
				"skills/test.md": "# Test",
			});

			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => clonedDir);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/my-org/my-project.git",
				ref: "HEAD",
			};

			const result = await fetcher.fetch(location);
			expect(result.name).toBe("my-org/my-project");
		});

		it("extracts owner/repo from URL correctly", async () => {
			const clonedDir = trackDir(createTempDir("ki-clone-"));
			createMockClonedRepo(clonedDir, {
				"skills/x.md": "# X",
			});

			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => clonedDir);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/a/b.git",
				ref: "HEAD",
			};

			const result = await fetcher.fetch(location);
			expect(result.name).toBe("a/b");
		});

		it("reads ki-skill.json from specified path subdirectory", async () => {
			const clonedDir = trackDir(createTempDir("ki-clone-"));
			createMockClonedRepo(clonedDir, {
				"packages/my-skill/ki-skill.json": JSON.stringify({
					name: "my-skill",
					version: "0.1.0",
				}),
				"packages/my-skill/skill.md": "# My Skill",
				"packages/other/skill.md": "# Other",
			});

			spyOn(GitFetcher.prototype as any, "cloneGitRepo").mockImplementation(() => clonedDir);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/test/mono.git",
				ref: "main",
				path: "packages/my-skill",
			};

			const result = await fetcher.fetch(location);

			expect(result.name).toBe("my-skill");
			expect(result.version).toBe("0.1.0");
			// Should include skill.md but NOT ki-skill.json
			expect(result.files.length).toBe(1);
			expect(result.files[0].relativePath).toContain("skill.md");
		});
	});

	describe("cloneGitRepo (integration)", () => {
		it("uses git clone with --depth 1 and --branch when ref is specified", async () => {
			const spawnSpy = spyOn(Bun, "spawnSync");
			spawnSpy.mockReturnValue({
				stdout: Buffer.from(""),
				stderr: Buffer.from(""),
				exitCode: 0,
				success: true,
			} as any);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/owner/repo.git",
				ref: "v1.0",
			};

			try {
				await (fetcher as any).cloneGitRepo(location);
			} catch {
				// May fail because the temp dir doesn't actually exist
				// We just want to check the spawn args
			}

			// Check that spawnSync was called
			expect(spawnSpy.mock.calls.length).toBeGreaterThan(0);

			const callArgs = spawnSpy.mock.calls[0];
			// First arg is the command string, second is args array
			const command = callArgs[0] as string;
			const args = callArgs[1] as string[];

			expect(command).toBe("git");
			expect(args).toContain("clone");
			expect(args).toContain("--depth");
			expect(args).toContain("1");
			expect(args).toContain("--branch");
			expect(args).toContain("v1.0");
		});

		it("does not pass --branch when ref is HEAD", async () => {
			const spawnSpy = spyOn(Bun, "spawnSync");
			spawnSpy.mockReturnValue({
				stdout: Buffer.from(""),
				stderr: Buffer.from(""),
				exitCode: 0,
				success: true,
			} as any);

			const location: ResolvedLocation = {
				type: "github",
				url: "https://github.com/owner/repo.git",
				ref: "HEAD",
			};

			try {
				await (fetcher as any).cloneGitRepo(location);
			} catch {
				// expected
			}

			const callArgs = spawnSpy.mock.calls[0];
			const args = callArgs[1] as string[];
			expect(args).not.toContain("--branch");
		});
	});
});
