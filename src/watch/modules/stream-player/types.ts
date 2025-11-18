export type VideoResolution = { readonly x: number; readonly y: number };

export enum PlayerState {
	LOADING = "loading",
	READY = "ready",
}

export enum PlayerNotices {
	LOADING = "Stream Loading",
	OFFLINE = "Stream Unavailable",
}
