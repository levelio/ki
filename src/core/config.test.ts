import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KI_CONFIG_FILE, readKiConfig, validateKiConfig, writeKiConfig } from "./config.js";

function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), "ki-test-"));
}

describe("validateKiConfig", () => {
	test("accepts valid config", () => {
		const config = { skills: { debug: "local:./skills/debug" } };
		expect(validateKiConfig(config)).toBe(true);
	});

	test("rejects config without skills field", () => {
		expect(() => validateKiConfig({})).toThrow("missing 'skills' field");
	});

	test("rejects config with non-object skills", () => {
		expect(() => validateKiConfig({ skills: "bad" })).toThrow("'skills' must be an object");
	});

	test("rejects skill with empty source value", () => {
		expect(() => validateKiConfig({ skills: { debug: "" } })).toThrow(
			"Invalid source spec for 'debug'",
		);
	});
});

describe("readKiConfig", () => {
	test("reads valid .ki.json from directory", () => {
		const dir = makeTempDir();
		const configPath = join(dir, KI_CONFIG_FILE);
		require("node:fs").writeFileSync(
			configPath,
			JSON.stringify({ skills: { tdd: "github:user/repo@v1.0" } }),
		);
		const config = readKiConfig(dir);
		expect(config.skills.tdd).toBe("github:user/repo@v1.0");
		rmSync(dir, { recursive: true });
	});

	test("throws on missing .ki.json", () => {
		const dir = makeTempDir();
		expect(() => readKiConfig(dir)).toThrow("Run `ki init` first");
		rmSync(dir, { recursive: true });
	});

	test("throws on invalid JSON", () => {
		const dir = makeTempDir();
		const configPath = join(dir, KI_CONFIG_FILE);
		require("node:fs").writeFileSync(configPath, "{ bad json");
		expect(() => readKiConfig(dir)).toThrow("Invalid .ki.json");
		rmSync(dir, { recursive: true });
	});
});

describe("writeKiConfig", () => {
	test("writes config to .ki.json", () => {
		const dir = makeTempDir();
		writeKiConfig(dir, { skills: { debug: "local:./debug" } });
		const config = readKiConfig(dir);
		expect(config.skills.debug).toBe("local:./debug");
		rmSync(dir, { recursive: true });
	});
});

describe("ki init", () => {
	test("creates .ki.json with schema and empty skills", () => {
		const dir = makeTempDir();
		writeKiConfig(dir, { skills: {} });
		const config = readKiConfig(dir);
		expect(config.$schema).toBe("https://ki.dev/schema/ki.json");
		expect(config.skills).toEqual({});
		rmSync(dir, { recursive: true });
	});

	test("refuses to overwrite existing .ki.json", () => {
		const dir = makeTempDir();
		writeKiConfig(dir, { skills: {} });
		expect(() => writeKiConfig(dir, { skills: {} }, { overwrite: false })).toThrow(
			"Already initialized",
		);
		rmSync(dir, { recursive: true });
	});
});
