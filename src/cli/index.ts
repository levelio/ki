#!/usr/bin/env bun
import { Command } from "commander";
import { runInit } from "./init.js";
import { readKiConfig, KI_CONFIG_FILE } from "../core/config.js";
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
	.option("--agent <agent>", "Install to specific agent only")
	.option("--json", "Output as JSON")
	.action(async (source?: string, opts?: { agent?: string; json?: boolean }) => {
		if (opts?.json) logger.setJson(true);
		// TODO: wire up engine for Phase 1 install
		logger.info("Install command not yet wired — engine ready");
	});

program
	.command("uninstall <name>")
	.description("Uninstall a skill")
	.action(async (name: string) => {
		// TODO: wire up engine
		logger.info(`Uninstall ${name} not yet wired`);
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
			for (const [name, source] of entries) {
				logger.info(`  ${name.padEnd(20)} ${source}`);
			}
		} catch (err) {
			handleError(err);
		}
	});

function handleError(err: unknown): never {
	if (err instanceof KiError) {
		logger.error(err.message);
		process.exit(err.exitCode);
	}
	logger.error((err as Error).message);
	process.exit(1);
}

program.parse();
