import { WebRTCReader } from "./webrtc/index.ts";
import type { BackendConfig } from "../../../../types.ts";
import type { GenericReader } from "./interface.ts";
import { HLSReader } from "./hls/index.ts";

export enum StreamProtocol {
	WebRTC_TCP = "webrtc-tcp",
	WebRTC_UDP = "webrtc-udp",
	HLS = "hls",
}

const defaultProtocol = StreamProtocol.WebRTC_UDP;

export function streamProtocolFromString(
	protocol: string | undefined | null,
): StreamProtocol {
	if (
		protocol &&
		(Object.values(StreamProtocol) as string[]).includes(protocol)
	) {
		return protocol as StreamProtocol;
	} else {
		return defaultProtocol;
	}
}

export class StreamReader {
	private streamProtocol: StreamProtocol = defaultProtocol;

	private backendConfig: BackendConfig = {};

	private reader: GenericReader | undefined = undefined;

	private video: HTMLVideoElement | undefined = undefined;
	private bufferLength: number | null = null;
	private onError: (err: unknown) => void = () => {};

	private supportedProtocols: StreamProtocol[] = [];

	constructor() {
		this.backendConfig = (window as any).REMOTE_CONFIG;
		for (const k of Object.values(StreamProtocol)) {
			switch (k) {
				case StreamProtocol.WebRTC_TCP:
				case StreamProtocol.WebRTC_UDP:
					if (WebRTCReader.supported()) {
						this.supportedProtocols.push(k);
					}
					break;
				case StreamProtocol.HLS:
					if (HLSReader.supported()) {
						this.supportedProtocols.push(k);
					}
					break;
				default:
					console.error(`No case for protocol ${k}!`);
					break;
			}
		}
	}

	public async setup(streamProtocol: StreamProtocol) {
		this.streamProtocol = streamProtocol;
	}

	public async start(
		video: HTMLVideoElement,
		bufferLength: number | null,
		onError: (err: unknown) => void,
	) {
		this.video = video;
		this.bufferLength = bufferLength;
		this.onError = onError;
		this._start();
	}

	public getSupportedProtocols() {
		return this.supportedProtocols;
	}

	private _start() {
		switch (this.streamProtocol) {
			case StreamProtocol.WebRTC_TCP:
			case StreamProtocol.WebRTC_UDP:
				if (!this.backendConfig.webRtcUrl) {
					throw {
						message: "Protocol Not Available",
						error: new Error(
							`Protocol ${this.streamProtocol} is not available for this stream`,
						),
					};
				} else {
					this.reader = new WebRTCReader({
						url: this.backendConfig.webRtcUrl,
						protocol: this.streamProtocol,
						bufferLength: this.bufferLength,
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
			case StreamProtocol.HLS:
				if (!this.backendConfig.hlsUrl) {
					throw {
						message: "Protocol Not Available",
						error: new Error(
							`Protocol ${this.streamProtocol} is not available for this stream`,
						),
					};
				} else if (this.video) {
					this.reader = new HLSReader({
						url: this.backendConfig.hlsUrl,
						protocol: this.streamProtocol,
						bufferLength: this.bufferLength,
						videoElement: this.video,
						onError: this.onError,
					});
				} else {
					throw {
						message: "Unable to start player",
						error: new Error("Invalid video element"),
					};
				}
				break;
			default:
				throw {
					message: "Unable to start player",
					error: new Error(
						`No case for protocol ${this.streamProtocol}!`,
					),
				};
		}
	}

	public async getStats(): Promise<unknown> {
		if (this.reader) {
			return await this.reader.getStats();
		}
	}

	public setBufferLength(length: number | null) {
		if (this.reader) {
			this.bufferLength = length;
			this.reader.close();
			this._start();
		}
	}

	public close() {
		if (this.reader) {
			this.reader.close();
		}
	}
}
