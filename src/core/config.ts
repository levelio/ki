import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigError } from "../utils/errors.js";
import type { KiConfig } from "./types.js";

export const KI_CONFIG_FILE = ".ki.json";
const KI_SCHEMA_URL = "https://ki.dev/schema/ki.json";

export function validateKiConfig(raw: unknown): raw is KiConfig {
	if (typeof raw !== "object" || raw === null) {
		throw new ConfigError("Invalid .ki.json: expected an object");
	}
	const config = raw as Record<string, unknown>;

	if (!("skills" in config)) {
		throw new ConfigError("Invalid .ki.json: missing 'skills' field");
	}

	if (typeof config.skills !== "object" || config.skills === null) {
		throw new ConfigError("Invalid .ki.json: 'skills' must be an object");
	}

	for (const [name, value] of Object.entries(config.skills as Record<string, unknown>)) {
		if (typeof value !== "string") {
			throw new ConfigError(`Invalid .ki.json: skill '${name}' value must be a string`);
		}
		if ((value as string).trim() === "") {
			throw new ConfigError(`Invalid source spec for '${name}': empty`);
		}
	}

	return true;
}

export function readKiConfig(projectDir: string): KiConfig {
	const configPath = join(projectDir, KI_CONFIG_FILE);

	if (!existsSync(configPath)) {
		throw new ConfigError("Run `ki init` first");
	}

	let raw: unknown;
	try {
		const content = readFileSync(configPath, "utf-8");
		raw = JSON.parse(content);
	} catch (err) {
		if (err instanceof SyntaxError) {
			throw new ConfigError(`Invalid .ki.json: ${err.message}`);
		}
		throw new ConfigError(`Failed to read .ki.json: ${(err as Error).message}`);
	}

	validateKiConfig(raw);
	return raw as KiConfig;
}

export function writeKiConfig(
	projectDir: string,
	config: KiConfig,
	options?: { overwrite?: boolean },
): void {
	const configPath = join(projectDir, KI_CONFIG_FILE);

	if (!options?.overwrite && existsSync(configPath)) {
		throw new ConfigError("Already initialized");
	}

	const output: KiConfig = {
		$schema: KI_SCHEMA_URL,
		...config,
	};

	writeFileSync(configPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
}
