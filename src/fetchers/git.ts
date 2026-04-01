import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { ResolvedLocation, SkillFile, SkillPackage } from "../core/types";
import { FetchError } from "../utils/errors";
import type { Fetcher } from "./fetcher";

interface KiSkillManifest {
	name?: string;
	version?: string;
	postinstall?: string;
	preuninstall?: string;
}

/**
 * Fetches skill packages by cloning git repositories.
 */
export class GitFetcher implements Fetcher {
	async fetch(location: ResolvedLocation): Promise<SkillPackage> {
		let cloneDir: string;
		try {
			cloneDir = await this.cloneGitRepo(location);
		} catch (error) {
			throw new FetchError(
				`Failed to clone repository: ${location.url}. ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		const searchRoot = location.path ? join(cloneDir, location.path) : cloneDir;

		if (!existsSync(searchRoot)) {
			throw new FetchError(
				`Path "${location.path}" does not exist in cloned repository ${location.url}`,
			);
		}

		// Try to read ki-skill.json for metadata
		const manifest = this.readManifest(searchRoot);

		// Determine name: manifest > URL-derived > fallback
		const name = manifest?.name ?? this.deriveNameFromUrl(location.url);

		// Collect skill files using location strategy
		const files = this.collectSkillFiles(searchRoot, cloneDir);

		return {
			name,
			version: manifest?.version,
			files,
			source: location.url,
			postinstall: manifest?.postinstall,
			preuninstall: manifest?.preuninstall,
		};
	}

	/**
	 * Clones a git repository to a temp directory.
	 * Uses shallow clone (--depth 1) for efficiency.
	 * When ref is specified and not HEAD, uses --branch to checkout that ref.
	 */
	async cloneGitRepo(location: ResolvedLocation): Promise<string> {
		const tempDir = mkdtempSync(join(tmpdir(), "ki-clone-"));

		const args = ["git", "clone", "--depth", "1"];

		// Only add --branch if ref is specified and not HEAD
		if (location.ref && location.ref !== "HEAD") {
			args.push("--branch", location.ref);
		}

		args.push(location.url, tempDir);

		const result = Bun.spawnSync(args[0], args.slice(1), {
			stdout: "pipe",
			stderr: "pipe",
		});

		if (!result.success) {
			// Clean up the failed clone directory
			try {
				rmSync(tempDir, { recursive: true, force: true });
			} catch {
				// ignore cleanup errors
			}
			const stderr = result.stderr?.toString() ?? "Unknown error";
			throw new Error(`git clone failed: ${stderr}`);
		}

		return tempDir;
	}

	/**
	 * Reads ki-skill.json from the search root if it exists.
	 */
	private readManifest(searchRoot: string): KiSkillManifest | undefined {
		const manifestPath = join(searchRoot, "ki-skill.json");
		if (!existsSync(manifestPath)) {
			return undefined;
		}

		try {
			const content = readFileSync(manifestPath, "utf-8");
			return JSON.parse(content) as KiSkillManifest;
		} catch {
			return undefined;
		}
	}

	/**
	 * Derives a skill name from the git URL (owner/repo).
	 */
	private deriveNameFromUrl(url: string): string {
		// Extract owner/repo from URL like https://github.com/owner/repo.git
		const match = url.match(/([^/]+)\/([^/]+?)(?:\.git)?$/);
		if (match) {
			return `${match[1]}/${match[2]}`;
		}
		return url;
	}

	/**
	 * Collects skill files from the search root using the skill location strategy:
	 * 1. If path is specified, include all files under that path
	 * 2. If skills/ directory exists, include all files under skills/
	 * 3. Otherwise, include *.md files at root level
	 */
	private collectSkillFiles(searchRoot: string, cloneRoot: string): SkillFile[] {
		const files: SkillFile[] = [];

		// Check if a specific path was requested (searchRoot !== cloneRoot means path was specified)
		const isPathSpecified = searchRoot !== cloneRoot;

		if (isPathSpecified) {
			// Include all files under the specified path, relative to cloneRoot
			this.walkDirectory(searchRoot, cloneRoot, files);
		} else if (existsSync(join(searchRoot, "skills"))) {
			// Strategy: use skills/ directory
			this.walkDirectory(join(searchRoot, "skills"), cloneRoot, files);
		} else {
			// Fallback: *.md files at root
			this.collectRootMdFiles(searchRoot, files);
		}

		return files;
	}

	/**
	 * Recursively walks a directory, collecting all files.
	 */
	private walkDirectory(dir: string, relativeRoot: string, files: SkillFile[]): void {
		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			// Skip hidden files/directories
			if (entry.name.startsWith(".")) continue;
			// Skip ki-skill.json (it's metadata, not a skill file)
			if (entry.name === "ki-skill.json") continue;

			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				files.push({
					relativePath: relative(relativeRoot, fullPath),
					absolutePath: fullPath,
					isDirectory: true,
				});
				this.walkDirectory(fullPath, relativeRoot, files);
			} else if (entry.isFile()) {
				files.push({
					relativePath: relative(relativeRoot, fullPath),
					absolutePath: fullPath,
					isDirectory: false,
				});
			}
		}
	}

	/**
	 * Collects only *.md files at the root level.
	 */
	private collectRootMdFiles(searchRoot: string, files: SkillFile[]): void {
		const entries = readdirSync(searchRoot, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
				const fullPath = join(searchRoot, entry.name);
				files.push({
					relativePath: entry.name,
					absolutePath: fullPath,
					isDirectory: false,
				});
			}
		}
	}
}
