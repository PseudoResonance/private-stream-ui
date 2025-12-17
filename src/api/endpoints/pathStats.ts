import { defaultEndpointsFactory } from "express-zod-api";
import { z } from "zod";
import type ApiBackend from "../backend";
import type { OIDCDataMiddleware } from "../types";
import createHttpError from "http-errors";
import type { ConfigOptions } from "../../config";

interface BackendPathStats {
	name: string;
	ready: boolean;
	tracks: string[];
	bytesReceived: number;
	bytesSent: number;
	readers: {
		type: string;
		id: string;
	}[];
}

export const PathPublicStatsObject = z.object({
	codecs: z.array(z.string()).describe("List of stream codecs"),
	ready: z.boolean().describe("Whether a stream is available to watch"),
});

export const PathPrivateStatsObject = z.object({
	...PathPublicStatsObject.shape,
	clients: z.number().gte(0).describe("Number of clients watching"),
	bytesReceived: z
		.number()
		.gte(0)
		.describe("Number of bytes streamed to server"),
	bytesSent: z.number().gte(0).describe("Number of bytes sent to clients"),
});

export type PathPublicStatsObjectType = z.infer<typeof PathPublicStatsObject>;
export type PathPrivateStatsObjectType = z.infer<typeof PathPrivateStatsObject>;

export default class PathStatsEndpoints {
	public pathUserEndpoint;
	public pathOwnerEndpoint;

	constructor(
		api: ApiBackend,
		authHandler: Parameters<
			typeof defaultEndpointsFactory.addExpressMiddleware
		>[0],
		validateAuth: Parameters<
			typeof defaultEndpointsFactory.addExpressMiddleware
		>[0],
		oidcUserDataMiddleware: OIDCDataMiddleware,
		config: ConfigOptions,
	) {
		const baseEndpointFactory = defaultEndpointsFactory
			.addExpressMiddleware(authHandler)
			.addExpressMiddleware(validateAuth)
			.addMiddleware(oidcUserDataMiddleware);
		this.pathUserEndpoint = defaultEndpointsFactory.build({
			method: "get",
			tag: "paths",
			shortDescription: "Fetch public path data",
			description: "Fetches basic data about the stream on a path",
			input: z.object({
				path: z.string().describe("Path name"),
				token: z.string().describe("Read access token"),
			}),
			output: PathPublicStatsObject,
			handler: async ({ input: { path, token } }) => {
				if (config.thumbnailHttpsPort && api.apiKey) {
					const tokens = await api.getTokensUnsafe(path);
					if (
						tokens.find(
							(val) =>
								val.querytoken === token &&
								val.action === "read",
						) === undefined
					) {
						throw createHttpError(403, "Forbidden", {
							expose: true,
						});
					}
					const backendUrl = `${config.providerBase}:${config.thumbnailHttpsPort}/v3/paths/get/${path}?token=${api.apiKey}`;
					const res = await fetch(backendUrl);
					const resJson: BackendPathStats = await res.json();
					if ("status" in resJson && resJson.status === "error") {
						return { codecs: [], ready: false };
					}
					return {
						codecs: resJson.tracks,
						ready: resJson.ready,
					};
				} else {
					throw createHttpError(500, "Internal error", {
						expose: true,
					});
				}
			},
		});
		this.pathOwnerEndpoint = baseEndpointFactory.build({
			method: "get",
			tag: "paths",
			shortDescription: "Fetch private path data",
			description: "Fetches all data about the stream on a path",
			input: z.object({
				path: z.string().describe("Path name"),
				override: z
					.literal(["true", "false"])
					.transform((val) => val === "true")
					.default(false)
					.optional()
					.describe(
						"Allow fetching paths of other users - Restricted to admins",
					),
			}),
			output: PathPrivateStatsObject,
			handler: async ({ input: { path, override }, options }) => {
				if (config.thumbnailHttpsPort && api.apiKey) {
					if (!(options.admin && override)) {
						const userPaths = await api.getPathsByOwner(
							options.user,
						);
						if (
							userPaths.find((val) => val.path === path) ===
							undefined
						) {
							throw createHttpError(403, "Forbidden", {
								expose: true,
							});
						}
					}
					const backendUrl = `${config.providerBase}:${config.thumbnailHttpsPort}/v3/paths/get/${path}?token=${api.apiKey}`;
					const res = await fetch(backendUrl);
					const resJson: BackendPathStats = await res.json();
					if ("status" in resJson && resJson.status === "error") {
						return {
							codecs: [],
							ready: false,
							clients: 0,
							bytesReceived: 0,
							bytesSent: 0,
						};
					}
					//TODO improve stats for HLS muxer
					return {
						codecs: resJson.tracks,
						ready: resJson.ready,
						clients: resJson.readers.length,
						bytesReceived: Math.max(resJson.bytesReceived, 0),
						bytesSent: Math.max(resJson.bytesSent, 0),
					};
				} else {
					throw createHttpError(500, "Internal error", {
						expose: true,
					});
				}
			},
		});
	}
}
