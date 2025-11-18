import {
	html,
	css,
	LitElement,
	type TemplateResult,
	type PropertyValues,
} from "lit";
import { customElement, state } from "lit/decorators.js";

import "media-chrome";
import "media-chrome/menu";
import { PlayerNotices, PlayerState, type VideoResolution } from "./types.ts";
import {
	StreamProtocol,
	streamProtocolFromString,
	StreamReader,
} from "./protocols/index.ts";
import {
	createIndicator,
	createMenuItem,
} from "media-chrome/dist/menu/media-chrome-menu.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("stream-player")
export class StreamPlayer extends LitElement {
	private static _retryTimeout = 2000;
	private static _statsTimeout = 10000;
	private static _videoErrorTimeout = 4000;

	constructor() {
		super();
		this._streamProtocol = streamProtocolFromString(
			localStorage.getItem("stream-protocol"),
		);
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

	protected firstUpdated(_changedProperties: PropertyValues): void {
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
		if ("getAutoplayPolicy" in navigator) {
			switch ((navigator as any).getAutoplayPolicy("mediaelement")) {
				case "allowed":
					break;
				case "allowed-muted":
					console.log("Detected autoplay must be muted!");
					videoElem.muted = true;
					break;
				default:
					break;
			}
		}
		const urlQuery = new URLSearchParams(window.location.search);
		if (!videoElem.muted && urlQuery.get("mute") !== null) {
			videoElem.muted = true;
		}
	}

	@state()
	private _videoInitState: PlayerState = PlayerState.LOADING;
	@state()
	private _errorMessage: TemplateResult<1> | string = PlayerNotices.LOADING;
	@state()
	private _videoResolution: VideoResolution = { x: 16, y: 9 };
	@state()
	private _streamProtocol: StreamProtocol;

	private _statsTimer: NodeJS.Timeout | undefined = undefined;
	private _retryTimer: NodeJS.Timeout | undefined = undefined;
	private _streamReader: StreamReader;

	private _videoErrorTimer: NodeJS.Timeout | undefined = undefined;

	private _setErrorMessage = (msg: string) => {
		this._errorMessage = html`${msg}<br />Retrying...`;
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
			const videoElem = this.shadowRoot?.getElementById(
				"html-player",
			) as HTMLVideoElement | null;
			if (videoElem === null) {
				console.error("Unable to find video element!");
				return;
			}
			await this._streamReader.setup(this._streamProtocol);
			await this._streamReader.start(
				videoElem,
				null, //TODO buffer size
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
		try {
			let stats;
			if (this._streamReader) {
				try {
					stats = await this._streamReader.getStats();
				} catch (_) {}
			}
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
		} catch (e) {
			console.error("Error while fetching stats", e);
		}
		this._statsTimer = setTimeout(
			this._processStats,
			StreamPlayer._statsTimeout,
		);
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
		playerElem?.style.setProperty("aspect-ratio", `${videoRatio}/1`);
	};

	videoTemplate() {
		return html`<video
			slot="media"
			id="html-player"
			class="${this._videoInitState}"
			controlslist="nodownload"
			poster="${(window as any).REMOTE_CONFIG?.thumbnailUrl ?? ""}"
			@loadeddata="${(e: Event) => {
				this._videoResolution = {
					x: (e.composedPath()[0] as HTMLVideoElement).videoWidth,
					y: (e.composedPath()[0] as HTMLVideoElement).videoHeight,
				};
				this._recalculateVideoFit();
				this._videoInitState = PlayerState.READY;
				this._errorMessage = "";
			}}"
			@waiting="${(_: Event) => {
				clearTimeout(this._videoErrorTimer);
				this._videoErrorTimer = setTimeout(() => {
					try {
						clearTimeout(this._videoErrorTimer);
						this._videoErrorTimer = undefined;
						console.error("Video stalled, assuming failed");
						this._setErrorMessage(PlayerNotices.OFFLINE);
						this._setupPlayer();
					} catch (e) {
						console.error(e);
					}
				}, StreamPlayer._videoErrorTimeout);
			}}"
			@playing="${() => {
				clearTimeout(this._videoErrorTimer);
				if (this._videoErrorTimer !== undefined) {
					console.log("Video playback resuming");
				}
				this._videoErrorTimer = undefined;
			}}"
			@play="${() => {
				if (this._streamReader) {
					this._streamReader.play();
				}
			}}"
			@pause="${() => {
				if (this._streamReader) {
					this._streamReader.pause();
				}
			}}"
		></video>`;
	}

	settingsTemplate() {
		const supportedProtocols = this._streamReader.getSupportedProtocols();
		return html` <media-settings-menu hidden anchor="auto">
			<media-settings-menu-item>
				Protocol
				<media-chrome-menu
					@change="${(e: Event) => {
						try {
							this._setStreamProtocol(
								streamProtocolFromString(
									(e.composedPath()[0] as HTMLInputElement)
										.value,
								),
							);
						} catch (e) {
							console.error(e);
							this._setStreamProtocol(StreamProtocol.WebRTC_UDP);
						}
					}}"
					slot="submenu"
					hidden
				>
					<div slot="title">Protocol</div>
					${Object.entries(StreamProtocol)
						.filter(([_, v]) => supportedProtocols.includes(v))
						.map(([k, v]) => {
							const item = createMenuItem({
								type: "radio",
								text: k.replaceAll("_", " "),
								value: v,
								checked: v === this._streamProtocol,
							});
							item.prepend(
								createIndicator(this, "checked-indicator"),
							);
							return item;
						})}
				</media-chrome-menu>
			</media-settings-menu-item>
		</media-settings-menu>`;
	}

	static styles = css`
		:host {
			position: relative;
			width: fit-content;
			height: fit-content;
			overflow: hidden;
			user-select: none;
			-webkit-touch-callout: none;
			-webkit-user-select: none;
			-ms-user-select: none;
			-moz-user-select: none;
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
		video::-webkit-media-controls-start-playback-button,
		video::-webkit-media-controls,
		video::-webkit-media-controls-enclosure {
			display: none !important;
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
			padding: 10px;
			background: var(--overlay-bg-color);
			border-radius: var(--border-radius);
			/* backdrop-filter: var(--popup-filter); */
		}

		.spacer {
			flex-grow: 1;
			background-color: var(
				--media-control-background,
				rgba(20, 20, 30, 0.7)
			);
		}

		media-airplay-button[mediaairplayunavailable],
		media-cast-button[mediacastunavailable],
		media-fullscreen-button[mediafullscreenunavailable],
		media-pip-button[mediapipunavailable] {
			display: none;
		}

		media-airplay-button[mediaisairplaying],
		media-cast-button[mediaiscasting],
		media-pip-button[mediaispip] {
			--media-primary-color: var(--button-active-color);
		}
	`;

	render() {
		return html`
			<media-controller>
				${this.videoTemplate()} ${this.settingsTemplate()}
				<media-control-bar>
					<media-play-button
						aria-disabled=${this._errorMessage ? true : false}
						?disabled="${this._errorMessage ? true : false}"
						style="${this._errorMessage
							? "pointer-events:none;touch-action:none;"
							: ""}"
					></media-play-button>
					<media-mute-button></media-mute-button>
					<media-volume-range></media-volume-range>
					<div class="spacer"></div>
					<media-cast-button
						aria-disabled=${this._errorMessage ? true : false}
						?disabled="${this._errorMessage ? true : false}"
						style="${this._errorMessage
							? "pointer-events:none;touch-action:none;"
							: ""}"
					></media-cast-button>
					<media-airplay-button
						aria-disabled=${this._errorMessage ? true : false}
						?disabled="${this._errorMessage ? true : false}"
						style="${this._errorMessage
							? "pointer-events:none;touch-action:none;"
							: ""}"
					></media-airplay-button>
					<media-pip-button
						aria-disabled=${this._errorMessage ? true : false}
						?disabled="${this._errorMessage ? true : false}"
						style="${this._errorMessage
							? "pointer-events:none;touch-action:none;"
							: ""}"
					></media-pip-button>
					<media-settings-menu-button></media-settings-menu-button>
					<media-fullscreen-button></media-fullscreen-button>
				</media-control-bar>
			</media-controller>
			<div
				class=${classMap({
					active: this._errorMessage ? true : false,
					error: true,
				})}
				aria-hidden="${this._errorMessage ? false : true}"
				aria-modal="${this._errorMessage ? true : false}"
			>
				<span class="errorContent">${this._errorMessage}</span>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementStreamPlayer {
		"stream-player": StreamPlayer;
	}
}
