export type VideoResolution = { readonly x: number; readonly y: number };

export enum PlayerState {
	LOADING = "loading",
	READY = "ready",
}

interface BaseStatType {
	id: string;
	type: string;
	key: string;
}

export namespace StatTypes {
	export interface StatValue extends BaseStatType {
		type: "value";
		value: unknown;
	}
	export interface StatGraph extends BaseStatType {
		type: "graph";
		value: number;
		valueString?: unknown;
		stdDevScale?: boolean;
		graphColor?: string;
		backgroundColor?: string;
		history: number[]; // Handled internally
	}
}

export type StatTypesAll = StatTypes.StatValue | StatTypes.StatGraph;

export type PlayerStats = StatTypesAll[];
