import { beforeEach, describe, expect, test } from "bun:test";
import { Logger } from "./logger.js";

describe("Logger", () => {
	let output: { text: string; level: string }[];
	let logger: Logger;

	beforeEach(() => {
		output = [];
		logger = new Logger({
			write: (text: string, level: string) => output.push({ text, level }),
		});
	});

	test("info outputs with info level", () => {
		logger.info("hello");
		expect(output).toHaveLength(1);
		expect(output[0].level).toBe("info");
		expect(output[0].text).toContain("hello");
	});

	test("success outputs with success level", () => {
		logger.success("done");
		expect(output[0].level).toBe("success");
		expect(output[0].text).toContain("done");
	});

	test("warn outputs with warn level", () => {
		logger.warn("careful");
		expect(output[0].level).toBe("warn");
		expect(output[0].text).toContain("careful");
	});

	test("error outputs with error level", () => {
		logger.error("broken");
		expect(output[0].level).toBe("error");
		expect(output[0].text).toContain("broken");
	});

	test("quiet mode suppresses info and success", () => {
		logger.setQuiet(true);
		logger.info("hidden");
		logger.success("hidden");
		logger.error("visible");
		expect(output).toHaveLength(1);
		expect(output[0].level).toBe("error");
	});

	test("json mode outputs raw JSON", () => {
		logger.setJson(true);
		logger.info("hello");
		expect(output[0].text).toBe('{"level":"info","message":"hello"}');
	});

	test("step outputs progress text", () => {
		logger.step(2, 5, "Installing debug");
		expect(output[0].level).toBe("info");
		expect(output[0].text).toContain("2/5");
		expect(output[0].text).toContain("Installing debug");
	});
});
