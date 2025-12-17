import express from "express";
import ApiBackend from "./backend";

import {
	createConfig,
	attachRouting,
	type Routing,
	type AppConfig,
	Documentation,
	DependsOnMethod,
	Middleware,
} from "express-zod-api";
import { apiReference } from "@scalar/express-api-reference";
import PathsEndpoints from "./endpoints/paths";
import type Config from "../config";
import TokensEndpoints from "./endpoints/tokens";
import PathStatsEndpoints from "./endpoints/pathStats";

export default class ApiHandler {
	private static apiVersion: string = "1.0.0";

	private app: express.Express;
	private config: Config;
	private zodConfig: AppConfig;
	private api: ApiBackend = new ApiBackend();

	constructor(app: express.Express, config: Config) {
		this.app = app;
		this.config = config;
		this.zodConfig = createConfig({
			app: this.app,
			cors: false,
		});
	}

	private static validateAuth(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction,
	): void {
		if (!req.oidc.user || !req.oidc.user.is_admin) {
			res.oidc.logout();
			return;
		}
		next();
	}

	private static oidcInjectMiddleware = new Middleware({
		handler: async ({ request }) => {
			if (
				request.oidc.user?.sub === undefined ||
				request.oidc.user?.sub === null ||
				request.oidc.user?.sub.length === 0
			) {
				throw new Error("Unknown user");
			}
			return {
				user: request.oidc.user?.sub,
				admin: request.oidc.user?.is_admin ?? false,
			};
		},
	});

	public setup(authHandler: () => express.RequestHandler<any>) {
		const pathsEndpoint = new PathsEndpoints(
			this.api,
			authHandler(),
			ApiHandler.validateAuth,
			ApiHandler.oidcInjectMiddleware,
			this.config.options.maxPaths,
		);
		const tokensEndpoint = new TokensEndpoints(
			this.api,
			authHandler(),
			ApiHandler.validateAuth,
			ApiHandler.oidcInjectMiddleware,
			this.config.options.maxTokens,
		);
		const pathStatsEndpoint = new PathStatsEndpoints(
			this.api,
			authHandler(),
			ApiHandler.validateAuth,
			ApiHandler.oidcInjectMiddleware,
			this.config.options,
		);
		const routing: Routing = {
			api: {
				v1: {
					path: new DependsOnMethod({
						get: pathsEndpoint.listPathsEndpoint,
						post: pathsEndpoint.createPathsEndpoint,
						delete: pathsEndpoint.deletePathsEndpoint,
					}),
					pathstats: new DependsOnMethod({
						get: pathStatsEndpoint.pathUserEndpoint,
					}),
					pathownerstats: new DependsOnMethod({
						get: pathStatsEndpoint.pathOwnerEndpoint,
					}),
					privatepath: new DependsOnMethod({
						post: pathsEndpoint.createPrivatePathEndpoint,
					}),
					token: new DependsOnMethod({
						get: tokensEndpoint.listTokensEndpoint,
						post: tokensEndpoint.createTokensEndpoint,
					}).nest({
						delete: new DependsOnMethod({
							post: tokensEndpoint.deleteTokensEndpoint,
						}),
					}),
					privatetoken: new DependsOnMethod({
						post: tokensEndpoint.createPrivateTokenEndpoint,
					}),
				},
			},
		};
		const documentation = new Documentation({
			routing,
			config: this.zodConfig,
			version: ApiHandler.apiVersion,
			title: `${this.config.options.playerTitle ?? "Private Stream"} Documentation`,
			serverUrl: this.config.options.serverBaseUrl,
			tags: {
				paths: { description: "Backend Paths" },
				tokens: { description: "Auth Tokens" },
			},
			hasHeadMethod: false,
		});
		this.app.use("/api/", express.json());
		const { notFoundHandler } = attachRouting(this.zodConfig, routing);
		this.app.use("/api/", notFoundHandler);
		this.app.use(
			"/docs",
			apiReference({
				pageTitle: `${this.config.options.playerTitle ?? "Private Stream"} Documentation`,
				showToolbar: "never",
				hideClientButton: true,
				content: documentation.getSpecAsJson(),
			}),
		);
	}
}
