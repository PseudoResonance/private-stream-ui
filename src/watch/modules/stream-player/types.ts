export type VideoResolution = { readonly x: number; readonly y: number };

export enum PlayerState {
	LOADING = "loading",
	READY = "ready",
}

export enum DebugStatsKey {
	VIDEO = 0,
	PROTOCOL = 1,
}
