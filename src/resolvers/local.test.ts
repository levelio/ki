import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalResolver } from "./local.js";

describe("LocalResolver", () => {
	const resolver = new LocalResolver();

	it("has type 'local'", () => {
		expect(resolver.type).toBe("local");
	});

	it("resolves local:./path to a ResolvedLocation with type 'local'", async () => {
		const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
		try {
			const skillFile = path.join(tempDir, "skill.md");
			writeFileSync(skillFile, "# Test skill");

			const spec = `local:./${path.relative(process.cwd(), skillFile)}`;
			const result = await resolver.resolve(spec);

			expect(result.type).toBe("local");
			expect(result.url).toBe(path.resolve(skillFile));
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("resolves local:absolute/path to a ResolvedLocation", async () => {
		const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
		try {
			const skillDir = path.join(tempDir, "skills", "helper");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(path.join(skillDir, "skill.md"), "# Helper skill");

			const result = await resolver.resolve(`local:${skillDir}`);

			expect(result.type).toBe("local");
			expect(result.url).toBe(skillDir);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("throws ResolveError when path doesn't exist", async () => {
		const nonExistent = path.join(tmpdir(), "ki-nonexistent-12345");

		expect(resolver.resolve(`local:${nonExistent}`)).rejects.toThrow(
			`Path not found: ${nonExistent}`,
		);
	});

	it("strips 'local:' prefix correctly", async () => {
		const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
		try {
			const skillFile = path.join(tempDir, "myskill.md");
			writeFileSync(skillFile, "# Skill");

			const result = await resolver.resolve(`local:${skillFile}`);

			// url should be the absolute path without the "local:" prefix
			expect(result.url).toBe(skillFile);
			expect(result.url).not.toContain("local:");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("resolves relative paths against cwd", async () => {
		const tempDir = mkdtempSync(path.join(tmpdir(), "ki-test-"));
		try {
			const skillFile = path.join(tempDir, "relative-skill.md");
			writeFileSync(skillFile, "# Relative");

			const relativePath = path.relative(process.cwd(), skillFile);
			const result = await resolver.resolve(`local:${relativePath}`);

			expect(result.url).toBe(path.resolve(skillFile));
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
