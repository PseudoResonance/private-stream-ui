import type { SQL } from "bun";
import type { PathObjectType } from "../endpoints/paths";
import type { TokenObjectType } from "../endpoints/tokens";

export default class DBSchema {
	private static _version: string = new Date(
		"2025-11-16T01:44:52+00:00",
	).toISOString();

	public static async setup(conn: SQL) {
		await conn`CREATE TABLE IF NOT EXISTS versions (
                application varchar(255) NOT NULL,
                version timestamp NOT NULL,
                PRIMARY KEY (application)
            )`;
		const currentVersion = await this.getVersion(conn);
		console.log(
			`Remote database version: ${currentVersion} Target version: ${this.getTargetVersion()}`,
		);
		await this.upgrade(conn, new Date(currentVersion));
	}

	private static async upgrade(conn: SQL, currentVersion: Date) {
		if (currentVersion <= new Date("1970-01-01T00:00:00.000Z")) {
			await conn`CREATE TABLE IF NOT EXISTS stream_auth (
                    path varchar(255) NOT NULL,
                    action varchar(50) NOT NULL,
                    querytoken varchar(255) NOT NULL,
                    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
                    PRIMARY KEY (path, action, querytoken)
                )`;
			await conn`CREATE TABLE IF NOT EXISTS stream_paths (
                    path varchar(255) NOT NULL,
                    owner varchar(255) NOT NULL,
                    PRIMARY KEY(path)
                )`;
		}
		// if (currentVersion < new Date("2025-11-16T01:44:52+00:00")) {
		// 	//Future schema upgrades
		// }
		await conn`INSERT INTO versions (application, version) VALUES (${"db_version"}, ${DBSchema.getTargetVersion()})
                    ON CONFLICT (application) DO UPDATE SET version=${DBSchema.getTargetVersion()}`;
		console.log(
			`Upgraded remote database version to ${DBSchema.getTargetVersion()}`,
		);
	}

	public static async getVersion(conn: SQL): Promise<string> {
		const res =
			await conn`SELECT version FROM versions WHERE application = ${"db_version"}`.values();
		return res.length > 0 ? res[0][0] : "1970-01-01T00:00:00.000Z";
	}

	public static getTargetVersion(): string {
		return this._version;
	}

	public static async getPaths(
		conn: SQL,
		paths?: string[],
	): Promise<PathObjectType[]> {
		const res = (await (paths && paths.length > 0))
			? conn`SELECT path, owner FROM stream_paths WHERE path IN ${conn(paths)}`
			: conn`SELECT path, owner FROM stream_paths`;
		return res;
	}

	public static async getPathsByOwner(
		conn: SQL,
		owner: string,
		paths?: string[],
	): Promise<PathObjectType[]> {
		const res = (await (paths && paths.length > 0))
			? conn`SELECT path, owner FROM stream_paths WHERE owner = ${owner} AND path IN ${conn(paths)}`
			: conn`SELECT path, owner FROM stream_paths WHERE owner = ${owner}`;
		return res;
	}

	public static async deletePathsUnsafe(
		conn: SQL,
		paths: string[],
	): Promise<PathObjectType[]> {
		return await conn.begin(async (tx) => {
			await tx`DELETE FROM stream_auth WHERE path IN ${conn(paths)}`;
			return await tx`DELETE FROM stream_paths OUTPUT WHERE path IN ${conn(paths)} RETURNING path, owner`;
		});
	}

	public static async deletePaths(
		conn: SQL,
		paths: string[],
		owner: string,
	): Promise<PathObjectType[]> {
		return await conn.begin(async (tx) => {
			await tx`DELETE FROM stream_auth WHERE path IN ${conn(paths)}`;
			return await tx`DELETE FROM stream_paths OUTPUT WHERE path IN ${conn(paths)} AND owner = ${owner} RETURNING path, owner`;
		});
	}

	public static async createPaths(
		conn: SQL,
		paths: PathObjectType[],
	): Promise<PathObjectType[]> {
		return await conn`INSERT INTO stream_paths ${conn(paths)} ON CONFLICT (path) DO NOTHING RETURNING path, owner`;
	}

	public static async getTokensUnsafe(
		conn: SQL,
		path: string,
	): Promise<TokenObjectType[]> {
		return await conn`SELECT path, action, querytoken FROM stream_auth WHERE path = ${path}`;
	}

	public static async getTokens(
		conn: SQL,
		path: string,
		owner: string,
	): Promise<TokenObjectType[] | null> {
		return await conn.begin(async (tx) => {
			const rows =
				await tx`SELECT 1 FROM stream_paths WHERE owner = ${owner} AND path = ${path}`;
			if (Array.isArray(rows) && rows.length > 0) {
				return await tx`SELECT path, action, querytoken FROM stream_auth WHERE path = ${path}`;
			}
			return null;
		});
	}

	public static async deleteTokensUnsafe(
		conn: SQL,
		tokens: TokenObjectType[],
	): Promise<TokenObjectType[]> {
		const returnRows: TokenObjectType[] = [];
		for (const token of tokens) {
			const row =
				await conn`DELETE FROM stream_auth OUTPUT WHERE path = ${token.path} AND action = ${token.action} AND querytoken = ${token.querytoken} RETURNING path, action, querytoken`;
			if (Array.isArray(row) && row.length > 0) {
				row.forEach((val: TokenObjectType) => returnRows.push(val));
			}
		}
		return returnRows;
	}

	public static async deleteTokens(
		conn: SQL,
		tokens: TokenObjectType[],
		owner: string,
	): Promise<TokenObjectType[]> {
		return await conn.begin(async (tx) => {
			let rows =
				await tx`SELECT path FROM stream_paths WHERE owner = ${owner} AND path IN ${conn(tokens, "path")}`;
			if (Array.isArray(rows) && rows.length > 0) {
				rows = rows.map((val) => val.path);
				const returnRows: TokenObjectType[] = [];
				const finalTokens = tokens.filter((val) =>
					rows.includes(val.path),
				);
				for (const token of finalTokens) {
					let row =
						await tx`DELETE FROM stream_auth OUTPUT WHERE path = ${token.path} AND action = ${token.action} AND querytoken = ${token.querytoken} RETURNING path, action, querytoken`;
					if (Array.isArray(row) && row.length > 0) {
						row.forEach((val: TokenObjectType) =>
							returnRows.push(val),
						);
					}
				}
				return returnRows;
			}
			return [];
		});
	}

	public static async createTokens(
		conn: SQL,
		tokens: TokenObjectType[],
	): Promise<TokenObjectType[] | null> {
		return await conn.begin(async (tx) => {
			let rows =
				await tx`SELECT path FROM stream_paths WHERE path IN ${conn(tokens, "path")}`;
			if (Array.isArray(rows) && rows.length > 0) {
				rows = rows.map((val) => val.path);
				const finalTokens = tokens.filter((val) =>
					rows.includes(val.path),
				);
				return await conn`INSERT INTO stream_auth ${conn(finalTokens)} ON CONFLICT (path, action, querytoken) DO NOTHING RETURNING path, action, querytoken`;
			}
			return null;
		});
	}
}
