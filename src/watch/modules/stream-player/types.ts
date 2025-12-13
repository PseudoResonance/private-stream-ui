export type VideoResolution = { readonly x: number; readonly y: number };

export enum PlayerState {
	LOADING = "loading",
	READY = "ready",
}

interface BaseStatType {
	type: string;
	key: string;
}

export namespace StatTypes {
	export interface StatValue extends BaseStatType {
		type: "value";
		value: unknown[] | unknown;
	}
}

type StatTypesAll = StatTypes.StatValue;

export type PlayerStats = StatTypesAll[];
