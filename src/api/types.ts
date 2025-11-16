import type { Middleware } from "express-zod-api";

export type OIDCDataMiddleware = Middleware<
	any,
	{
		user: any;
		admin: any;
	},
	any,
	undefined
>;
