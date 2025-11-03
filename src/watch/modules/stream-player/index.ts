import { html, css, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import update, { type Spec } from "immutability-helper";

import "./controls.ts";
import { PlayerState, type VideoResolution, type VideoState } from "./types.ts";
import {
	StreamProtocol,
	streamProtocolFromString,
	StreamReader,
} from "./protocols/index.ts";

@customElement("stream-player")
export class StreamPlayer extends LitElement {
	constructor() {
		super();
		this._streamProtocol = streamProtocolFromString(
			localStorage.getItem("stream-protocol"),
		);
		this.addEventListener("pointermove", () => {
			clearTimeout(this._activityTimer);
			this._active = true;
			this._activityTimer = setTimeout(
				this._activityTimerFunc,
				this.activityTimeout,
			);
		});
		this.addEventListener("pointerleave", () => {
			clearTimeout(this._activityTimer);
			this._hovering = false;
			this._active = false;
		});
		this.addEventListener("fullscreenchange", () => {
			if (document.fullscreenElement === this) {
				this._updateVideoStateInternal({ fullscreen: { $set: true } });
			} else if (document.fullscreenElement === null) {
				this._updateVideoStateInternal({ fullscreen: { $set: false } });
			}
		});
		const viewportResizeObserver = new ResizeObserver(() => {
			this._recalculateVideoFit();
		});
		viewportResizeObserver.observe(this.offsetParent ?? this);
		this._streamReader = new StreamReader();

		window.addEventListener("load", this._setupPlayer);
		window.addEventListener("beforeunload", () => {
			this._streamReader.close();
		});
		this._statsTimer = setTimeout(
			this._processStats,
			StreamPlayer._statsTimeout,
		);
	}

	private static _retryTimeout = 2000;
	private static _statsTimeout = 10000;

	@property({ type: Number })
	activityTimeout: number = 2000;

	@state()
	private _active: boolean = false;
	@state()
	private _hovering: boolean = false;
	@state()
	private _submenuOpen: boolean = false;
	@state()
	private _videoInitState: PlayerState = PlayerState.LOADING;
	@state()
	private _errorMessage: TemplateResult<1> | string = "Loading Stream";
	@state()
	private _videoState: VideoState = {
		playing: false,
		fullscreen: false,
		bufferLength: null,
	};
	@state()
	private _videoResolution: VideoResolution = { x: 16, y: 9 };

	private _streamProtocol: StreamProtocol;

	private _statsTimer: NodeJS.Timeout | undefined = undefined;
	private _retryTimer: NodeJS.Timeout | undefined = undefined;
	private _activityTimer: NodeJS.Timeout | undefined = undefined;
	private _streamReader: StreamReader;

	private _setErrorMessage = (msg: string) => {
		this._errorMessage = html`${msg}<br />Retrying in
			${StreamPlayer._retryTimeout / 1000}s`;
	};

	private _setStreamProtocol = (protocol: StreamProtocol) => {
		if (this._streamProtocol !== protocol) {
			console.log(`Switching to protocol ${protocol}`);
			this._streamProtocol = protocol;
			localStorage.setItem("stream-protocol", protocol);
			this._streamReader.close();
			this._setupPlayer();
		}
	};

	private _setupPlayer = async () => {
		try {
			await this._streamReader.setup(this._streamProtocol);
			const videoElem = this.shadowRoot?.getElementById(
				"html-player",
			) as HTMLVideoElement | null;
			if (videoElem === null) {
				console.error("Unable to find video element!");
				return;
			}
			videoElem.controls = false;
			videoElem.muted = false;
			videoElem.autoplay = true;
			videoElem.playsInline = true;
			videoElem.disablePictureInPicture = false;
			await this._streamReader.start(
				videoElem as HTMLVideoElement,
				this._videoState.bufferLength,
				(e) => {
					if (e && typeof e === "object") {
						if ("message" in e) {
							this._setErrorMessage(String(e.message));
						} else {
							this._setErrorMessage("Unknown Error");
						}
					} else {
						this._setErrorMessage(String(e));
					}
					console.error(e);
					this._retryTimer = setTimeout(
						this._setupPlayer,
						StreamPlayer._retryTimeout,
					);
				},
			);
		} catch (e) {
			if (e && typeof e === "object") {
				if ("message" in e) {
					this._setErrorMessage(String(e.message));
				} else {
					this._setErrorMessage("Unknown Error");
				}
			} else {
				this._setErrorMessage(String(e));
			}
			console.error(e);
			this._retryTimer = setTimeout(
				this._setupPlayer,
				StreamPlayer._retryTimeout,
			);
		}
	};

	private _processStats = async () => {
		const stats = await this._streamReader.getStats();
		if (stats) {
			if (
				typeof stats === "object" &&
				stats.constructor.name === "RTCStatsReport"
			) {
				const statsObj = {
					bytesReceived: 0,
					jitter: 0,
					jitterBuffer: 0,
					packetsDiscarded: 0,
					packetsLost: 0,
					packetsReceived: 0,
				};
				let jitterArr: number[] = [];
				let jitterBufferArr: number[] = [];
				(stats as RTCStatsReport).forEach((entry) => {
					if (entry.type === "inbound-rtp") {
						statsObj.bytesReceived += entry.bytesReceived;
						jitterArr.push(entry.jitter);
						jitterBufferArr.push(
							entry.jitterBufferTargetDelay /
								entry.jitterBufferEmittedCount,
						);
						statsObj.packetsDiscarded += entry.packetsDiscarded;
						statsObj.packetsLost += entry.packetsLost;
						statsObj.packetsReceived += entry.packetsReceived;
					}
				});
				statsObj.jitter =
					jitterArr.reduce((a, b) => a + b, 0) / jitterArr.length;
				statsObj.jitterBuffer =
					jitterBufferArr.reduce((a, b) => a + b, 0) /
					jitterBufferArr.length;
				console.log(statsObj);
			}
		}
		this._statsTimer = setTimeout(
			this._processStats,
			StreamPlayer._statsTimeout,
		);
	};

	private _activityTimerFunc = () => {
		if (!this._hovering && !this._submenuOpen) {
			this._active = false;
		}
	};

	private _updateVideoStateInternal(stateUpdate: Spec<VideoState, never>) {
		this._videoState = update(this._videoState, stateUpdate);
	}

	private _updateVideoState = (stateUpdate: Partial<VideoState>) => {
		for (const [k, v] of Object.entries(stateUpdate)) {
			if (v === undefined) {
				continue;
			}
			const key = k as keyof VideoState;
			const value = v as VideoState[keyof VideoState];
			if (v !== this._videoState[key]) {
				const oldValue = this._videoState[key];
				const playerElem = this.shadowRoot?.getElementById(
					"html-player",
				) as HTMLVideoElement | null;
				switch (key) {
					case "fullscreen":
						if (value === true) {
							this.requestFullscreen();
						} else {
							document.exitFullscreen();
						}
						break;
					case "playing":
						if (value === true) {
							playerElem?.play();
						} else {
							playerElem?.pause();
						}
						break;
					case "bufferLength":
						console.log(
							`Setting buffer size to ${value === null ? "default" : value}`,
						);
						this._updateVideoStateInternal({
							bufferLength: { $set: value as number },
						});
						this._streamReader.setBufferLength(value as number);
						break;
				}
			}
		}
	};

	private _recalculateVideoFit = () => {
		let viewportX = 0;
		let viewportY = 0;
		if (this.offsetParent !== null) {
			viewportX = this.offsetParent.getBoundingClientRect().width;
			viewportY = this.offsetParent.getBoundingClientRect().height;
		} else {
			viewportX = this.getBoundingClientRect().width;
			viewportY = this.getBoundingClientRect().height;
		}
		const viewportRatio = viewportX / viewportY;
		const videoRatio = this._videoResolution.x / this._videoResolution.y;
		const playerElem = this.shadowRoot?.getElementById("html-player");
		if (viewportRatio < videoRatio) {
			playerElem?.style.setProperty("min-width", "100svw");
			playerElem?.style.setProperty("min-height", "auto");
		} else {
			playerElem?.style.setProperty("min-width", "auto");
			playerElem?.style.setProperty("min-height", "100svh");
		}
	};

	static styles = css`
		:host {
			position: relative;
			width: fit-content;
			height: fit-content;
			overflow: hidden;
			user-select: none;
			-webkit-user-select: none;
			-ms-user-select: none;
			display: flex;
			justify-content: center;
		}
		video {
			background: var(--video-bg-color);
			max-width: 100svw;
			max-height: 100svh;
			object-fit: contain;
			min-width: 100vmin;
			min-height: 100vmin;
			pointer-events: none;
			touch-action: none;
		}
		.error {
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			max-width: 100svw;
			max-height: 100svh;
			display: flex;
			align-items: center;
			text-align: center;
			justify-content: center;
			font-size: xx-large;
			font-weight: bold;
			color: var(--fg-color);
			pointer-events: none;
			padding: 20px;
			box-sizing: border-box;
		}
		.error.active .errorContent {
			backdrop-filter: var(--popup-filter);
			padding: 10px;
			background: var(--overlay-bg-color);
			border-radius: var(--border-radius);
		}
		.controls {
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			max-width: 100svw;
			max-height: 100svh;
			pointer-events: none;
			touch-action: none;
			font-size: x-large;
		}
	`;

	// src="https://44610fa9-3e30-4e16-b568-7529ed57cf0d.mdnplay.dev/shared-assets/videos/flower.webm"
	render() {
		return html`
			<video
				id="html-player"
				class="${this._videoInitState}"
				controlslist="nodownload"
				@play="${() => {
					this._updateVideoStateInternal({ playing: { $set: true } });
				}}"
				@pause="${() => {
					this._updateVideoStateInternal({
						playing: { $set: false },
					});
				}}"
				@loadeddata="${(e: Event) => {
					const trackSettings = (
						(e.target as HTMLVideoElement).srcObject as MediaStream
					)
						.getVideoTracks()[0]
						?.getSettings();
					if (trackSettings) {
						this._videoResolution = {
							x: trackSettings.width as number,
							y: trackSettings.height as number,
						};
					}
					this._recalculateVideoFit();
					this._videoInitState = PlayerState.READY;
					this._errorMessage = "";
				}}"
			></video>
			<div class="error ${this._errorMessage ? "active" : ""}">
				<span class="errorContent">${this._errorMessage}</span>
			</div>
			<player-controls
				class="controls"
				@pointerleave="${() => {
					this._hovering = false;
				}}"
				@pointerenter="${() => {
					this._hovering = true;
				}}"
				?disabled="${this._videoInitState !== PlayerState.READY}"
				?active="${this._active}"
				.videoState="${this._videoState}"
				.updateVideoState="${this._updateVideoState}"
				.setStreamProtocol="${this._setStreamProtocol}"
			></player-controls>
		`;
	}
}

declare global {
	interface HTMLElementStreamPlayer {
		"stream-player": StreamPlayer;
	}
}
