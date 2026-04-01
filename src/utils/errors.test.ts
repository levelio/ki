import { describe, expect, test } from "bun:test";
import {
	AgentError,
	CLIError,
	ConfigError,
	FetchError,
	InstallError,
	KiError,
	ResolveError,
} from "./errors.js";

describe("KiError", () => {
	test("has name, message, code, exitCode", () => {
		const err = new KiError("Something went wrong");
		expect(err.name).toBe("KiError");
		expect(err.message).toBe("Something went wrong");
		expect(err.code).toBe("KI_ERROR");
		expect(err.exitCode).toBe(1);
	});

	test("accepts custom code and exitCode", () => {
		const err = new KiError("bad", { code: "CUSTOM", exitCode: 42 });
		expect(err.code).toBe("CUSTOM");
		expect(err.exitCode).toBe(42);
	});

	test("is instance of Error and KiError", () => {
		const err = new KiError("test");
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(KiError);
	});
});

describe("ConfigError", () => {
	test("has correct defaults", () => {
		const err = new ConfigError("Missing skills field");
		expect(err.name).toBe("ConfigError");
		expect(err.code).toBe("CONFIG_ERROR");
		expect(err.exitCode).toBe(1);
		expect(err).toBeInstanceOf(KiError);
	});
});

describe("ResolveError", () => {
	test("has correct defaults", () => {
		const err = new ResolveError("Repository not found: user/repo");
		expect(err.name).toBe("ResolveError");
		expect(err.code).toBe("RESOLVE_ERROR");
		expect(err.exitCode).toBe(1);
		expect(err).toBeInstanceOf(KiError);
	});
});

describe("FetchError", () => {
	test("has correct defaults", () => {
		const err = new FetchError("Network error: timeout");
		expect(err.name).toBe("FetchError");
		expect(err.code).toBe("FETCH_ERROR");
		expect(err.exitCode).toBe(1);
		expect(err).toBeInstanceOf(KiError);
	});
});

describe("InstallError", () => {
	test("has correct defaults", () => {
		const err = new InstallError("Permission denied: .claude/skills");
		expect(err.name).toBe("InstallError");
		expect(err.code).toBe("INSTALL_ERROR");
		expect(err.exitCode).toBe(1);
		expect(err).toBeInstanceOf(KiError);
	});
});

describe("AgentError", () => {
	test("has correct defaults", () => {
		const err = new AgentError("Agent not detected: gemini-cli");
		expect(err.name).toBe("AgentError");
		expect(err.code).toBe("AGENT_ERROR");
		expect(err.exitCode).toBe(1);
		expect(err).toBeInstanceOf(KiError);
	});
});

describe("CLIError", () => {
	test("has exitCode 2", () => {
		const err = new CLIError("Unknown option: --foo");
		expect(err.name).toBe("CLIError");
		expect(err.code).toBe("CLI_ERROR");
		expect(err.exitCode).toBe(2);
		expect(err).toBeInstanceOf(KiError);
	});
});
