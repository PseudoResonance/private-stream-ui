/* Mutability helpers */
type ImmutableObject<T> = {
	readonly [K in keyof T]: Immutable<T[K]>;
};

export type Immutable<T> = {
	// eslint-disable-next-line @typescript-eslint/ban-types
	readonly [K in keyof T]: T[K] extends Function
		? T[K]
		: ImmutableObject<T[K]>;
};

type MutableObject<T> = {
	-readonly [K in keyof T]: Mutable<T[K]>;
};

export type Mutable<T> = {
	// eslint-disable-next-line @typescript-eslint/ban-types
	-readonly [K in keyof T]: T[K] extends Function
		? T[K]
		: MutableObject<T[K]>;
};

export type VideoState = Immutable<{
	playing: boolean;
	fullscreen: boolean;
}>;

export type VideoResolution = Immutable<{ x: number; y: number }>;

export enum PlayerState {
	LOADING = "loading",
	READY = "ready",
}
