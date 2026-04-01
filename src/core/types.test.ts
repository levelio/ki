import { describe, expect, test } from "bun:test";
import { parseSourceSpec } from "./types.js";

describe("parseSourceSpec", () => {
	test("parses github: source", () => {
		const spec = parseSourceSpec("github:user/repo@v1.0");
		expect(spec.type).toBe("github");
		expect(spec.ref).toBe("v1.0");
		expect(spec.path).toBe("");
	});

	test("parses github: with path", () => {
		const spec = parseSourceSpec("github:user/repo@v1.0:skills/debug");
		expect(spec.type).toBe("github");
		expect(spec.ref).toBe("v1.0");
		expect(spec.path).toBe("skills/debug");
	});

	test("parses local: source", () => {
		const spec = parseSourceSpec("local:./my-skills/helper");
		expect(spec.type).toBe("local");
		expect(spec.raw).toBe("./my-skills/helper");
	});

	test("parses bare name as registry fallback", () => {
		const spec = parseSourceSpec("tdd");
		expect(spec.type).toBe("registry");
		expect(spec.raw).toBe("tdd");
	});

	test("parses registry: explicit", () => {
		const spec = parseSourceSpec("registry:tdd@^1.0");
		expect(spec.type).toBe("registry");
		expect(spec.raw).toBe("tdd@^1.0");
	});

	test("throws on empty string", () => {
		expect(() => parseSourceSpec("")).toThrow();
	});
});
