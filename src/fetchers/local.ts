import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ResolvedLocation, SkillFile, SkillPackage } from "../core/types.js";
import { FetchError } from "../utils/errors.js";
import type { Fetcher } from "./fetcher.js";

export class LocalFetcher implements Fetcher {
	async fetch(location: ResolvedLocation): Promise<SkillPackage> {
		const targetPath = location.url;

		if (!existsSync(targetPath)) {
			throw new FetchError(`Path not found: ${targetPath}`);
		}

		const stat = statSync(targetPath);
		const name = path.basename(targetPath, path.extname(targetPath));

		if (stat.isFile()) {
			return {
				name,
				files: [
					{
						relativePath: path.basename(targetPath),
						absolutePath: targetPath,
						isDirectory: false,
					},
				],
				source: targetPath,
			};
		}

		// Directory: walk recursively to collect all files and directories
		const files: SkillFile[] = [];
		this.collectFiles(targetPath, targetPath, files);

		return {
			name,
			files,
			source: targetPath,
		};
	}

	private collectFiles(baseDir: string, currentDir: string, files: SkillFile[]): void {
		const entries = readdirSync(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			const relativePath = path.relative(baseDir, fullPath);

			if (entry.isDirectory()) {
				files.push({
					relativePath,
					absolutePath: fullPath,
					isDirectory: true,
				});
				this.collectFiles(baseDir, fullPath, files);
			} else {
				files.push({
					relativePath,
					absolutePath: fullPath,
					isDirectory: false,
				});
			}
		}
	}
}
