import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ResolvedLocation } from "../core/types.js";
import { LocalFetcher } from "./local.js";

describe("LocalFetcher", () => {
	const fetcher = new LocalFetcher();

	describe("fetch", () => {
		it("fetches a single file skill (returns SkillPackage with files)", async () => {
			const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
			try {
				const skillFile = path.join(tempDir, "skill.md");
				writeFileSync(skillFile, "# Test skill content");

				const location: ResolvedLocation = {
					type: "local",
					url: skillFile,
				};

				const result = await fetcher.fetch(location);

				expect(result.name).toBe("skill");
				expect(result.source).toBe(skillFile);
				expect(result.files).toHaveLength(1);
				expect(result.files[0].relativePath).toBe("skill.md");
				expect(result.files[0].absolutePath).toBe(skillFile);
				expect(result.files[0].isDirectory).toBe(false);
			} finally {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		it("fetches a directory skill (returns SkillPackage with all files)", async () => {
			const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
			try {
				const skillDir = path.join(tempDir, "helper");
				mkdirSync(skillDir, { recursive: true });
				writeFileSync(path.join(skillDir, "main.md"), "# Main skill");
				writeFileSync(path.join(skillDir, "extra.md"), "# Extra content");
				mkdirSync(path.join(skillDir, "sub"));
				writeFileSync(path.join(skillDir, "sub", "nested.md"), "# Nested");

				const location: ResolvedLocation = {
					type: "local",
					url: skillDir,
				};

				const result = await fetcher.fetch(location);

				expect(result.name).toBe("helper");
				expect(result.source).toBe(skillDir);
				expect(result.files.length).toBeGreaterThanOrEqual(3);

				const relativePaths = result.files.map((f) => f.relativePath);
				expect(relativePaths).toContain("main.md");
				expect(relativePaths).toContain("extra.md");
				expect(relativePaths).toContain(path.join("sub", "nested.md"));
			} finally {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		it("throws FetchError when path doesn't exist", async () => {
			const nonExistent = path.join(tmpdir(), "ki-nonexistent-99999");

			const location: ResolvedLocation = {
				type: "local",
				url: nonExistent,
			};

			expect(fetcher.fetch(location)).rejects.toThrow(`Path not found: ${nonExistent}`);
		});

		it("correctly sets isDirectory false for single files", async () => {
			const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
			try {
				const skillFile = path.join(tempDir, "single.md");
				writeFileSync(skillFile, "# Single");

				const location: ResolvedLocation = {
					type: "local",
					url: skillFile,
				};

				const result = await fetcher.fetch(location);

				expect(result.files).toHaveLength(1);
				expect(result.files[0].isDirectory).toBe(false);
			} finally {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		it("correctly sets isDirectory for directory entries", async () => {
			const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
			try {
				const skillDir = path.join(tempDir, "multi-skill");
				mkdirSync(skillDir, { recursive: true });
				writeFileSync(path.join(skillDir, "a.md"), "# A");
				mkdirSync(path.join(skillDir, "subdir"));
				writeFileSync(path.join(skillDir, "subdir", "b.md"), "# B");

				const location: ResolvedLocation = {
					type: "local",
					url: skillDir,
				};

				const result = await fetcher.fetch(location);

				const subDirEntry = result.files.find((f) => f.relativePath === "subdir");
				expect(subDirEntry).toBeDefined();
				expect(subDirEntry?.isDirectory).toBe(true);

				const fileEntry = result.files.find((f) => f.relativePath === "a.md");
				expect(fileEntry).toBeDefined();
				expect(fileEntry?.isDirectory).toBe(false);
			} finally {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});
	});
});
