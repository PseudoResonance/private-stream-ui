import { defaultEndpointsFactory } from "express-zod-api";
import { z } from "zod";
import type ApiBackend from "../backend";
import type { OIDCDataMiddleware } from "../types";
import { generateRandomString } from "../util";
import createHttpError from "http-errors";

const PathObjectInput = z.object({
	path: z.string(),
});

export const PathObject = z.object({
	...PathObjectInput.shape,
	owner: z.string(),
});

export type PathObjectInputType = z.infer<typeof PathObjectInput>;
export type PathObjectType = z.infer<typeof PathObject>;

export default class PathsEndpoints {
	public listPathsEndpoint;
	public createPathsEndpoint;
	public deletePathsEndpoint;
	public createPrivatePathEndpoint;

	constructor(
		api: ApiBackend,
		authHandler: Parameters<
			typeof defaultEndpointsFactory.addExpressMiddleware
		>[0],
		validateAuth: Parameters<
			typeof defaultEndpointsFactory.addExpressMiddleware
		>[0],
		oidcUserDataMiddleware: OIDCDataMiddleware,
		maxPaths: number | undefined,
	) {
		const baseEndpointFactory = defaultEndpointsFactory
			.addExpressMiddleware(authHandler)
			.addExpressMiddleware(validateAuth)
			.addMiddleware(oidcUserDataMiddleware);
		this.listPathsEndpoint = baseEndpointFactory.build({
			method: "get",
			tag: "paths",
			shortDescription: "List paths",
			description:
				"List all of a user's paths. Defaults to the current user.",
			input: z.object({
				paths: z
					.array(z.string())
					.or(z.string())
					.optional()
					.describe("Paths to list"),
				owner: z
					.string()
					.optional()
					.describe(
						"List paths owned by user - Restricted to admins",
					),
				all: z
					.literal(["true", "false"])
					.transform((val) => val === "true")
					.default(false)
					.optional()
					.describe("List all paths - Restricted to admins"),
			}),
			output: z.object({
				data: z.array(PathObject),
			}),
			handler: async ({ input: { paths, owner, all }, options }) => {
				paths = ([] as string[]).concat(paths ?? []);
				let targetOwner: string = options.user;
				if (!options.admin) {
					all = false;
				}
				if (owner && options.admin) {
					targetOwner = owner;
				}
				const data = await (all
					? api.getPaths(paths)
					: api.getPathsByOwner(targetOwner, paths));
				return { data };
			},
		});
		this.createPathsEndpoint = baseEndpointFactory.build({
			method: "post",
			tag: "paths",
			shortDescription: "Create paths",
			description:
				"Insert an array of paths with the specified owner. - Restricted to admins",
			input: z.object({
				data: z
					.array(PathObjectInput)
					.describe("Array of MediaMTX paths"),
				owner: z.string().optional().describe("Path owner"),
			}),
			output: z.object({
				data: z.array(PathObject),
			}),
			handler: async ({ input: { data: tokens, owner }, options }) => {
				if (!options.admin) {
					throw createHttpError(403, "Forbidden");
				}
				let targetOwner: string = options.user;
				if (owner && options.admin) {
					targetOwner = owner;
				}
				// Ensure config name and owner match
				const paths = tokens.map((obj) => {
					const ret = { ...obj, owner: targetOwner };
					return ret;
				});
				const data = await api.createPaths(paths);
				return { data };
			},
		});
		this.deletePathsEndpoint = baseEndpointFactory.build({
			method: "delete",
			tag: "paths",
			shortDescription: "Delete paths",
			description: "Deletes all paths specified",
			input: z.object({
				paths: z
					.array(z.string())
					.or(z.string())
					.describe("Paths to delete"),
				override: z
					.literal(["true", "false"])
					.transform((val) => val === "true")
					.default(false)
					.optional()
					.describe(
						"Allow deleting paths of other users - Restricted to admins",
					),
			}),
			output: z.object({
				data: z.array(PathObject),
			}),
			handler: async ({ input: { paths, override }, options }) => {
				paths = ([] as string[]).concat(paths ?? []);
				let data;
				if (options.admin && override) {
					data = await api.deletePathsUnsafe(paths);
				} else {
					data = await api.deletePaths(paths, options.user);
				}
				return { data };
			},
		});

		this.createPrivatePathEndpoint = baseEndpointFactory.build({
			method: "post",
			tag: "paths",
			shortDescription: "Create private path",
			description: "Create a new path with a randomly generated name",
			input: z.object({
				owner: z
					.string()
					.optional()
					.describe("Path owner - Restricted to admins"),
			}),
			output: z.object({
				data: z.array(PathObject),
			}),
			handler: async ({ input: { owner }, options }) => {
				let targetOwner: string = options.user;
				if (owner && options.admin) {
					targetOwner = owner;
				}
				const ownerPaths = await api.getPathsByOwner(targetOwner);
				if (
					maxPaths !== undefined &&
					ownerPaths.length + 1 > maxPaths
				) {
					throw createHttpError(
						400,
						"The path limit has been reached for this account",
					);
				}
				let newName = "";
				for (let i = 0; i < 2; i++) {
					const streamName = generateRandomString(10);
					const paths = await api.getPaths([streamName]);
					if (paths.length === 0) {
						newName = streamName;
						break;
					}
				}
				if (newName.length === 0) {
					throw createHttpError(400, "Unable to generate new name");
				}
				const path: PathObjectType = {
					owner: targetOwner,
					path: newName,
				};
				const data = await api.createPaths([path]);
				return { data };
			},
		});
	}
}
