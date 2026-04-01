import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { runInit } from "./init.js";

describe("ki init", () => {
	function makeTempDir(): string {
		return mkdtempSync(join(tmpdir(), "ki-test-"));
	}

	test("creates .ki.json in empty directory", () => {
		const dir = makeTempDir();
		runInit(dir);
		const configPath = join(dir, ".ki.json");
		expect(existsSync(configPath)).toBe(true);
		const content = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(content.$schema).toBe("https://ki.dev/schema/ki.json");
		expect(content.skills).toEqual({});
		rmSync(dir, { recursive: true });
	});

	test("throws when .ki.json already exists", () => {
		const dir = makeTempDir();
		runInit(dir);
		expect(() => runInit(dir)).toThrow("Already initialized");
		rmSync(dir, { recursive: true });
	});
});
