import { WebRTCReader } from "./webrtc/index.ts";
import type { BackendConfig } from "../../../../types.ts";
import type { GenericReader } from "./interface.ts";
import { HLSReader } from "./hls/index.ts";
import type { PlayerStats } from "../types.ts";
import { i18n } from "../../../../lang.ts";

export enum StreamProtocol {
	HLS = "hls",
	LL_HLS = "llhls",
	WebRTC = "webrtc",
	WebRTC_TCP = "webrtc-tcp",
	WebRTC_UDP = "webrtc-udp",
}

export const DefaultProtocols = [
	StreamProtocol.LL_HLS,
	StreamProtocol.WebRTC,
	StreamProtocol.HLS,
	StreamProtocol.WebRTC_UDP,
	StreamProtocol.WebRTC_TCP,
];

export function streamProtocolFromString(
	protocol: string | undefined | null,
): StreamProtocol {
	if (
		protocol &&
		(Object.values(StreamProtocol) as string[]).includes(protocol)
	) {
		return protocol as StreamProtocol;
	} else {
		return DefaultProtocols[0] as StreamProtocol;
	}
}

export class StreamReader {
	private streamProtocol: StreamProtocol =
		DefaultProtocols[0] as StreamProtocol;

	private backendConfig: BackendConfig = {};

	private reader: GenericReader | undefined = undefined;

	private video: HTMLVideoElement | undefined = undefined;
	private statsInterval: number = 0;
	private onStats: (stats: PlayerStats) => void = () => {};
	private onError: (err: unknown) => void = () => {};

	constructor() {
		this.backendConfig = (window as any).REMOTE_CONFIG;
	}

	public async setup(streamProtocol: StreamProtocol) {
		this.streamProtocol = streamProtocol;
	}

	public async start(
		video: HTMLVideoElement,
		statsInterval: number,
		onStats: (stats: PlayerStats) => void,
		onError: (err: unknown) => void,
		debugState: boolean,
	) {
		this.video = video;
		this.statsInterval = statsInterval;
		this.onStats = onStats;
		this.onError = onError;
		this._start(debugState);
	}

	private _start(debugState: boolean) {
		switch (this.streamProtocol) {
			case StreamProtocol.WebRTC:
			case StreamProtocol.WebRTC_TCP:
			case StreamProtocol.WebRTC_UDP:
				if (!this.backendConfig.webRtcUrl) {
					throw {
						message: i18n("playerStateOffline"),
						error: new Error(
							`Protocol ${this.streamProtocol} is not available for this stream`,
						),
					};
				} else {
					this.reader = new WebRTCReader({
						url: this.backendConfig.webRtcUrl,
						protocol: this.streamProtocol,
						statsInterval: this.statsInterval,
						onStats: this.onStats,
						onError: this.onError,
						onTrack: (evt: unknown) => {
							if (this.video) {
								this.video.srcObject = (evt as RTCTrackEvent)
									.streams[0] as MediaProvider;
							}
						},
					});
					break;
				}
			case StreamProtocol.LL_HLS:
			case StreamProtocol.HLS:
				if (!this.backendConfig.hlsUrl) {
					throw {
						message: i18n("playerStateOffline"),
						error: new Error(
							`Protocol ${this.streamProtocol} is not available for this stream`,
						),
					};
				} else if (this.video) {
					this.reader = new HLSReader({
						url: this.backendConfig.hlsUrl,
						protocol: this.streamProtocol,
						videoElement: this.video,
						statsInterval: this.statsInterval,
						onStats: this.onStats,
						onError: this.onError,
					});
				} else {
					throw {
						message: i18n("playerStateOffline"),
						error: new Error("Invalid video element"),
					};
				}
				break;
			default:
				throw {
					message: i18n("playerStateOffline"),
					error: new Error(
						`No case for protocol ${this.streamProtocol}!`,
					),
				};
		}
		if (this.reader) {
			this.reader.setDebugState(debugState);
		}
	}

	public setDebugState(state: boolean) {
		if (this.reader) {
			this.reader.setDebugState(state);
		}
	}

	public close() {
		if (this.reader) {
			this.reader.close();
		}
	}

	public play() {
		if (this.reader) {
			this.reader.play();
		}
	}

	public pause() {
		if (this.reader) {
			this.reader.pause();
		}
	}

	public static async calculateSupportedProtocols(
		codecs: string[],
	): Promise<StreamProtocol[]> {
		let protocols: StreamProtocol[] = [];
		if (WebRTCReader.supported()) {
			protocols = protocols.concat(
				await WebRTCReader.listSupportedProtocols(codecs),
			);
		}
		if (HLSReader.supported()) {
			protocols = protocols.concat(
				await HLSReader.listSupportedProtocols(codecs),
			);
		}
		return protocols;
	}

	public static getBestProtocol(
		validProtocols: StreamProtocol[],
	): StreamProtocol | null {
		for (const v of DefaultProtocols) {
			if (validProtocols.includes(v)) {
				return v;
			}
		}
		return null;
	}
}
