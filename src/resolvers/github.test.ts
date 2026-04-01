import { describe, expect, it } from "bun:test";
import { ResolveError } from "../utils/errors";
import { GitHubResolver } from "./github";

describe("GitHubResolver", () => {
	const resolver = new GitHubResolver();

	describe("type", () => {
		it('returns "github"', () => {
			expect(resolver.type).toBe("github");
		});
	});

	describe("resolve", () => {
		it("resolves user/repo with ref", async () => {
			const result = await resolver.resolve("github:user/repo@v1.0");
			expect(result).toEqual({
				type: "github",
				url: "https://github.com/user/repo.git",
				ref: "v1.0",
			});
		});

		it("defaults ref to HEAD when not specified", async () => {
			const result = await resolver.resolve("github:user/repo");
			expect(result).toEqual({
				type: "github",
				url: "https://github.com/user/repo.git",
				ref: "HEAD",
			});
		});

		it("resolves with ref and path", async () => {
			const result = await resolver.resolve("github:user/repo@v1.0:skills/debug");
			expect(result).toEqual({
				type: "github",
				url: "https://github.com/user/repo.git",
				ref: "v1.0",
				path: "skills/debug",
			});
		});

		it("resolves with path only (no ref)", async () => {
			const result = await resolver.resolve("github:user/repo:skills/debug");
			expect(result).toEqual({
				type: "github",
				url: "https://github.com/user/repo.git",
				ref: "HEAD",
				path: "skills/debug",
			});
		});

		it("throws ResolveError for invalid format (missing owner/repo)", async () => {
			expect(resolver.resolve("github:invalid")).rejects.toThrow(ResolveError);
		});

		it("throws ResolveError for missing repo", async () => {
			expect(resolver.resolve("github:user")).rejects.toThrow(ResolveError);
		});

		it("includes raw spec in error message", async () => {
			try {
				await resolver.resolve("github:invalid");
				expect.unreachable("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ResolveError);
				expect((error as ResolveError).message).toContain("invalid");
			}
		});
	});
});
