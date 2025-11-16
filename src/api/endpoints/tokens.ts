import { defaultEndpointsFactory } from "express-zod-api";
import { z } from "zod";
import type ApiBackend from "../backend";
import type { OIDCDataMiddleware } from "../types";
import { generateRandomString } from "../util";
import createHttpError from "http-errors";

const TokenAction = z.literal(["publish", "read"]);

export const TokenObject = z.object({
	path: z.string(),
	action: TokenAction,
	querytoken: z.string(),
});

export type TokenObjectType = z.infer<typeof TokenObject>;

export default class TokensEndpoints {
	public listTokensEndpoint;
	public createTokensEndpoint;
	public deleteTokensEndpoint;
	public createPrivateTokenEndpoint;

	constructor(
		api: ApiBackend,
		authHandler: Parameters<
			typeof defaultEndpointsFactory.addExpressMiddleware
		>[0],
		validateAuth: Parameters<
			typeof defaultEndpointsFactory.addExpressMiddleware
		>[0],
		oidcUserDataMiddleware: OIDCDataMiddleware,
		maxTokens: number | undefined,
	) {
		const baseEndpointFactory = defaultEndpointsFactory
			.addExpressMiddleware(authHandler)
			.addExpressMiddleware(validateAuth)
			.addMiddleware(oidcUserDataMiddleware);
		this.listTokensEndpoint = baseEndpointFactory.build({
			method: "get",
			tag: "tokens",
			shortDescription: "List tokens",
			description:
				"List all tokens associated with a given path. Defaults to the current user.",
			input: z.object({
				path: z.string().describe("Path name"),
				override: z
					.literal(["true", "false"])
					.transform((val) => val === "true")
					.default(false)
					.optional()
					.describe(
						"List token owned by other users - Restricted to admins",
					),
			}),
			output: z.object({
				data: z.array(TokenObject),
			}),
			handler: async ({ input: { path, override }, options }) => {
				let data;
				if (options.admin && override) {
					data = await api.getTokensUnsafe(path);
				} else {
					data = await api.getTokens(path, options.user);
				}
				if (data === null) {
					throw createHttpError(404, "Not found", { expose: true });
				}
				return { data: data as TokenObjectType[] };
			},
		});
		this.createTokensEndpoint = baseEndpointFactory.build({
			method: "post",
			tag: "tokens",
			shortDescription: "Create tokens",
			description:
				"Create an array of tokens associated with a given path. - Restricted to admins",
			input: z.object({
				path: z.string().describe("Path name"),
				data: z
					.array(TokenObject)
					.describe(
						"Array of auth tokens - If the token path doesn't match the create path, the token will be ignored",
					),
			}),
			output: z.object({
				data: z.array(TokenObject),
			}),
			handler: async ({ input: { path, data: tokens }, options }) => {
				if (!options.admin) {
					throw createHttpError(403, "Forbidden");
				}
				if (path.length === 0) {
					throw createHttpError(400, "Invalid path", {
						expose: true,
					});
				}
				const tokensObj = tokens
					.filter((val) => !val.path || val.path === path)
					.map((val) => {
						return { ...val, path: path };
					}) as TokenObjectType[];
				const data = await api.createTokens(tokensObj);
				if (data === null) {
					throw createHttpError(404, "Not found", { expose: true });
				}
				return { data };
			},
		});
		this.deleteTokensEndpoint = baseEndpointFactory.build({
			method: "post",
			tag: "tokens",
			shortDescription: "Delete tokens",
			description:
				"Deletes all specified tokens associated with a given path. Defaults to the current user.",
			input: z.object({
				path: z.string().describe("Path to delete from"),
				tokens: z
					.array(TokenObject)
					.describe(
						"Tokens to delete - If the token path doesn't match the delete path, the token will be ignored",
					),
				override: z
					.boolean()
					.default(false)
					.optional()
					.describe(
						"Allow deleting tokens of other users - Restricted to admins",
					),
			}),
			output: z.object({
				data: z.array(TokenObject),
			}),
			handler: async ({ input: { path, tokens, override }, options }) => {
				if (path.length === 0) {
					throw createHttpError(400, "Invalid path", {
						expose: true,
					});
				}
				const tokensObj = tokens
					.filter((val) => !val.path || val.path === path)
					.map((val) => {
						return { ...val, path: path };
					}) as TokenObjectType[];
				let data;
				if (options.admin && override) {
					data = await api.deleteTokensUnsafe(tokensObj);
				} else {
					data = await api.deleteTokens(tokensObj, options.user);
				}
				if (data === null) {
					throw createHttpError(404, "Not found", { expose: true });
				}
				return { data: data as TokenObjectType[] };
			},
		});

		this.createPrivateTokenEndpoint = baseEndpointFactory.build({
			method: "post",
			tag: "tokens",
			shortDescription: "Create private token",
			description:
				"Create a new randomly generated token for the given action",
			input: z.object({
				path: z.string().describe("Path name"),
				action: TokenAction.describe("Token action"),
				override: z
					.boolean()
					.default(false)
					.optional()
					.describe(
						"Allow creating tokens on other user's paths - Restricted to admins",
					),
			}),
			output: z.object({
				data: z.array(TokenObject),
			}),
			handler: async ({ input: { path, action, override }, options }) => {
				if (!options.admin) {
					override = false;
				}
				const pathRes = await (override
					? api.getPaths([path])
					: api.getPathsByOwner(options.user, [path]));
				if (pathRes.length === 0 || !pathRes[0]) {
					throw createHttpError(404, "Not found", { expose: true });
				}
				const pathName = pathRes[0].path;
				let newKey = "";
				let tokens = await (override
					? api.getTokensUnsafe(pathName)
					: api.getTokens(pathName, options.user));
				if (tokens === null) {
					throw createHttpError(404, "Not found", {
						expose: true,
					});
				}
				const publishExists = !!tokens.find(
					(val) => val.action === "publish",
				);
				const tokenCount = Math.max(
					0,
					tokens.length - (publishExists ? 1 : 0),
				);
				if (action === "publish" && publishExists) {
					throw createHttpError(
						400,
						"A publish token already exists for this path",
					);
				}
				if (
					action === "read" &&
					maxTokens !== undefined &&
					tokenCount + 1 > maxTokens
				) {
					throw createHttpError(
						400,
						"The token limit has been reached for this path",
					);
				}
				for (let i = 0; i < 2; i++) {
					const tokenKey = generateRandomString(100);
					if (
						!tokens.find(
							(val) =>
								val.action === action &&
								val.querytoken === newKey,
						)
					) {
						newKey = tokenKey;
						break;
					}
				}
				if (newKey.length === 0) {
					throw createHttpError(400, "Unable to generate new name");
				}
				const data = await api.createTokens([
					{
						path: pathName,
						action: action,
						querytoken: newKey,
					},
				]);
				if (data === null) {
					throw createHttpError(404, "Not found", {
						expose: true,
					});
				}
				return { data };
			},
		});
	}
}
