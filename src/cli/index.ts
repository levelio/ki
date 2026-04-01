#!/usr/bin/env bun
import { Command } from "commander";
import { runInit } from "./init.js";
import { readKiConfig, writeKiConfig, KI_CONFIG_FILE } from "../core/config.js";
import { createEngine } from "../core/orchestrator.js";
import { Logger } from "../utils/logger.js";
import { KiError } from "../utils/errors.js";

const logger = new Logger();
const program = new Command();

program.name("ki").description("AI Agent Skill Manager").version("0.1.0");

program
	.command("init")
	.description("Initialize .ki.json in current project")
	.action(() => {
		runInit(process.cwd());
		logger.success(`Created ${KI_CONFIG_FILE}`);
	});

program
	.command("install")
	.description("Install skills from .ki.json or a single skill spec")
	.argument("[source]", "Skill source spec (e.g. github:user/repo@v1.0)")
	.option("--name <name>", "Skill name (required when installing from spec)")
	.option("--agent <agent>", "Install to specific agent only")
	.option("--json", "Output as JSON")
	.action(async (source?: string, opts?: { name?: string; agent?: string; json?: boolean }) => {
		if (opts?.json) logger.setJson(true);

		const cwd = process.cwd();
		const engine = createEngine(cwd, { agent: opts?.agent });

		if (source) {
			// Single skill install
			const name = opts?.name ?? deriveNameFromSpec(source);
			const config = readKiConfig(cwd);

			const result = await engine.installSingle(config, name, source);

			if (result.skipped) {
				logger.info(`Already installed: ${name}`);
				return;
			}

			writeKiConfig(cwd, config, { overwrite: true });
			for (const item of result.installed) {
				logger.success(`Installed ${item.name}`);
			}
		} else {
			// Batch install from .ki.json
			const config = readKiConfig(cwd);
			const entries = Object.entries(config.skills);

			if (entries.length === 0) {
				logger.info("No skills to install");
				return;
			}

			const result = await engine.installAll(config);

			for (let i = 0; i < result.installed.length; i++) {
				logger.step(i + 1, result.installed.length, `Installed ${result.installed[i].name}`);
			}

			for (const fail of result.failed) {
				logger.error(`Failed ${fail.name}: ${fail.error}`);
			}

			if (result.failed.length > 0) {
				process.exit(1);
			}
		}
	});

program
	.command("uninstall <name>")
	.description("Uninstall a skill")
	.option("--agent <agent>", "Uninstall from specific agent only")
	.action(async (name: string, opts?: { agent?: string }) => {
		const cwd = process.cwd();
		const engine = createEngine(cwd, { agent: opts?.agent });
		const config = readKiConfig(cwd);

		await engine.uninstall(config, name);
		writeKiConfig(cwd, config, { overwrite: true });
		logger.success(`Uninstalled ${name}`);
	});

program
	.command("list")
	.description("List installed skills")
	.option("--agent <agent>", "Filter by agent")
	.option("--json", "Output as JSON")
	.action(async (opts?: { agent?: string; json?: boolean }) => {
		if (opts?.json) logger.setJson(true);

		try {
			const config = readKiConfig(process.cwd());
			const entries = Object.entries(config.skills);

			if (entries.length === 0) {
				logger.info("No skills installed");
				return;
			}

			if (opts?.json) {
				logger.info(JSON.stringify(Object.fromEntries(entries)));
				return;
			}

			for (const [name, source] of entries) {
				logger.info(`  ${name.padEnd(20)} ${source}`);
			}
		} catch (err) {
			handleError(err);
		}
	});

function deriveNameFromSpec(spec: string): string {
	// github:user/repo@ref → user/repo
	const match = spec.match(/(?:github:)?([^@]+)/);
	if (match) return match[1].split("/").pop() ?? spec;
	// local:./path/name → name
	if (spec.startsWith("local:")) {
		const parts = spec.slice(6).split("/");
		return parts.pop()?.replace(/\.[^.]+$/, "") ?? spec;
	}
	return spec;
}

function handleError(err: unknown): never {
	if (err instanceof KiError) {
		logger.error(err.message);
		process.exit(err.exitCode);
	}
	logger.error((err as Error).message);
	process.exit(1);
}

program.parse();
