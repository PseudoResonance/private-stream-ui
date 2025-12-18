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
import {
	PlayerState,
	type PlayerStats,
	type StatTypes,
	type StatTypesAll,
	type VideoResolution,
} from "./types.ts";
import {
	DefaultProtocols,
	StreamProtocol,
	streamProtocolFromString,
	StreamReader,
} from "./protocols/index.ts";
import {
	createIndicator,
	createMenuItem,
} from "media-chrome/dist/menu/media-chrome-menu.js";
import { classMap } from "lit/directives/class-map.js";
import { i18n } from "../../../lang.ts";
import "./modules-debug/graph";
import type { BackendConfig } from "../../../types.ts";
import type { PathPublicStatsObjectType } from "../../../api/endpoints/pathStats.ts";

@customElement("stream-player")
export class StreamPlayer extends LitElement {
	/**
	 * Interval in ms before retrying video stream
	 */
	private static RETRY_INTERVAL = 2000;
	/**
	 * Interval in ms to pull new stats
	 */
	private static STATS_REFRESH_INTERVAL = 1500;
	/**
	 * Max entries in history state
	 */
	private static STATS_MAX_HISTORY = 50;
	/**
	 * Duration in ms after which video is declared dead, and retry process is started
	 */
	private static VIDEO_ERROR_TIMEOUT = 8000;

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

		window.addEventListener("load", this._checkRemoteState);
		window.addEventListener("beforeunload", () => {
			this._streamReader.close();
		});
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
	private _errorMessage: TemplateResult<1> | string =
		i18n("playerStateLoading");
	@state()
	private _videoResolution: VideoResolution = { x: 16, y: 9 };
	@state()
	private _streamProtocol: StreamProtocol | null;
	@state()
	private _validProtocols: StreamProtocol[] = DefaultProtocols;
	@state()
	private _showDebugStats: boolean = false;
	@state()
	private _debugStats: Record<string, StatTypesAll> = {};

	private _globalStats: Record<string, StatTypesAll> = {};

	private _retryTimer: NodeJS.Timeout | undefined = undefined;
	private _streamReader: StreamReader;

	private _videoErrorTimer: NodeJS.Timeout | undefined = undefined;

	private _streamInfo: PathPublicStatsObjectType | undefined = undefined;

	private _fetchStreamInfo = async () => {
		try {
			if (((window as any).REMOTE_CONFIG as BackendConfig)?.apiStatsUrl) {
				const streamStats = await fetch(
					((window as any).REMOTE_CONFIG as BackendConfig)
						.apiStatsUrl as string,
				);
				if (streamStats.status !== 200) {
					this._streamInfo = undefined;
					return;
				}
				this._streamInfo = (await streamStats.json()).data;
			}
		} catch (e) {
			console.error(`Error while fetching remote stream info\n${e}`);
			this._streamInfo = undefined;
		}
	};

	private _setErrorMessage = (msg: string) => {
		this._errorMessage = html`${msg}<br />${i18n("retrying")}`;
	};

	private _setStreamProtocol = (protocol: StreamProtocol | null) => {
		if (
			!protocol ||
			(this._validProtocols.length > 0 &&
				!this._validProtocols.includes(protocol))
		) {
			protocol = StreamReader.getBestProtocol(this._validProtocols);
		}
		if (!protocol) {
			console.log(`No valid protocol to use!`);
			this._setErrorMessage(i18n("deviceUnsupported"));
			this._streamProtocol = protocol;
			this._streamReader.close();
			this._debugStats = {};
			this._globalStats = {};
			this._checkRemoteState();
		} else if (this._streamProtocol !== protocol) {
			console.log(`Switching to protocol ${protocol}`);
			this._streamProtocol = protocol;
			localStorage.setItem("stream-protocol", protocol);
			this._streamReader.close();
			this._debugStats = {};
			this._globalStats = {};
			this._checkRemoteState();
		}
	};

	private _handleDebugStats = (global: boolean = false) => {
		return (stats: PlayerStats) => {
			const work = { ...(global ? this._globalStats : this._debugStats) };
			for (const [id, entry] of Object.entries(stats)) {
				if (!(id in work)) {
					work[id] = entry;
				} else {
					switch (entry.type) {
						case "graph":
							const historyOld = (work[id] as StatTypes.StatGraph)
								.history;
							work[id] = entry;
							entry.history = historyOld.slice(
								historyOld.length >=
									StreamPlayer.STATS_MAX_HISTORY
									? 1
									: 0,
							);
							entry.history.push(entry.value);
							break;
						case "value":
						default:
							work[id] = entry;
							break;
					}
				}
			}
			if (global) {
				this._globalStats = work;
			} else {
				this._debugStats = work;
			}
		};
	};

	private _checkRemoteState = async () => {
		await this._fetchStreamInfo();
		if (this._streamInfo) {
			if (!this._streamInfo.ready) {
				this._setErrorMessage(i18n("playerStateOffline"));
				this._retryTimer = setTimeout(
					this._checkRemoteState,
					StreamPlayer.RETRY_INTERVAL,
				);
			} else {
				this._validProtocols =
					await StreamReader.calculateSupportedProtocols(
						this._streamInfo.codecs,
					);
				this.updateProtocolSettings();
				if (
					!this._streamProtocol ||
					!this._validProtocols.includes(this._streamProtocol)
				) {
					this._streamProtocol = StreamReader.getBestProtocol(
						this._validProtocols,
					);
				}
				if (!this._streamProtocol) {
					this._setErrorMessage(i18n("deviceUnsupported"));
					this._retryTimer = setTimeout(
						this._checkRemoteState,
						StreamPlayer.RETRY_INTERVAL,
					);
				} else {
					await this._setupPlayer(this._streamProtocol);
				}
			}
		} else {
			console.error("Unable to fetch remote stats, trying anyways...");
			this._validProtocols =
				await StreamReader.calculateSupportedProtocols([]);
			if (
				!this._streamProtocol ||
				!this._validProtocols.includes(this._streamProtocol)
			) {
				this._streamProtocol = StreamReader.getBestProtocol(
					this._validProtocols,
				);
			}
			if (!this._streamProtocol) {
				this._setErrorMessage(i18n("deviceUnsupported"));
				this._retryTimer = setTimeout(
					this._checkRemoteState,
					StreamPlayer.RETRY_INTERVAL,
				);
			} else {
				await this._setupPlayer(this._streamProtocol);
			}
		}
	};

	private _setupPlayer = async (protocol: StreamProtocol) => {
		try {
			if (this._streamReader) {
				this._streamReader.close();
			}
			const videoElem = this.shadowRoot?.getElementById(
				"html-player",
			) as HTMLVideoElement | null;
			if (videoElem === null) {
				console.error("Unable to find video element!");
				return;
			}
			await this._streamReader.setup(protocol);
			await this._streamReader.start(
				videoElem,
				StreamPlayer.STATS_REFRESH_INTERVAL,
				this._handleDebugStats(),
				(e) => {
					if (e && typeof e === "object") {
						if ("message" in e) {
							this._setErrorMessage(String(e.message));
						} else {
							this._setErrorMessage(i18n("errorUnknown"));
						}
					} else {
						this._setErrorMessage(String(e));
					}
					console.error(e);
					this._retryTimer = setTimeout(
						this._checkRemoteState,
						StreamPlayer.RETRY_INTERVAL,
					);
				},
				this._showDebugStats,
			);
		} catch (e) {
			if (e && typeof e === "object") {
				if ("message" in e) {
					this._setErrorMessage(String(e.message));
				} else {
					this._setErrorMessage(i18n("errorUnknown"));
				}
			} else {
				this._setErrorMessage(String(e));
			}
			console.error(e);
			this._retryTimer = setTimeout(
				this._checkRemoteState,
				StreamPlayer.RETRY_INTERVAL,
			);
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
		playerElem?.style.setProperty("aspect-ratio", `${videoRatio}/1`);
	};

	private videoTemplate() {
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
				this._handleDebugStats(true)([
					{
						type: "value",
						id: "statResolution",
						key: "statResolution",
						value: i18n(
							"statResolutionValue",
							this._videoResolution.x,
							this._videoResolution.y,
						),
					},
				]);
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
						this._setErrorMessage(i18n("playerStateOffline"));
						this._checkRemoteState();
					} catch (e) {
						console.error(e);
					}
				}, StreamPlayer.VIDEO_ERROR_TIMEOUT);
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

	private updateProtocolSettings() {
		const elem = this.shadowRoot?.getElementById("protocolMenu");
		const urlQuery = new URLSearchParams(window.location.search);
		const secretOptions = urlQuery.get("secret") !== null;
		for (const child of elem?.children ?? []) {
			if (
				child.nodeName.toLocaleLowerCase() === "media-chrome-menu-item"
			) {
				child.remove();
			}
		}
		// Delete elements again because of MediaChrome modifying them...
		for (const child of elem?.children ?? []) {
			if (
				child.nodeName.toLocaleLowerCase() === "media-chrome-menu-item"
			) {
				child.remove();
			}
		}
		//TODO close menu
		const items = Object.entries(StreamProtocol)
			.filter(([_, v]) => {
				if (!this._validProtocols.includes(v)) return false;
				else if (secretOptions && v === StreamProtocol.WebRTC)
					return false;
				else if (
					!secretOptions &&
					(v === StreamProtocol.WebRTC_UDP ||
						v === StreamProtocol.WebRTC_TCP)
				)
					return false;
				return true;
			})
			.map(([_, v]) => {
				const item = createMenuItem({
					type: "radio",
					text: i18n(`latency_${v}`),
					value: v,
					checked: v === this._streamProtocol,
				});
				item.prepend(createIndicator(this, "checked-indicator"));
				return item;
			});
		for (const item of items) {
			elem?.appendChild(item);
		}
	}

	private settingsTemplate() {
		return html`<media-settings-menu hidden anchor="auto">
			<media-chrome-menu-item
				@click="${() => {
					this._showDebugStats = !this._showDebugStats;
					this._debugStats = {};
					if (this._streamReader) {
						this._streamReader.setDebugState(this._showDebugStats);
					}
				}}"
				@keydown="${(e: KeyboardEvent) => {
					if (e.key === "Enter" || e.key === " ") {
						this._showDebugStats = !this._showDebugStats;
						this._debugStats = {};
						if (this._streamReader) {
							this._streamReader.setDebugState(
								this._showDebugStats,
							);
						}
					}
				}}"
			>
				<span>${i18n("debug")}</span>
			</media-chrome-menu-item>
			<media-settings-menu-item>
				${i18n("latency")}
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
							this._setStreamProtocol(null);
						}
					}}"
					slot="submenu"
					hidden
					id="protocolMenu"
				>
					<div slot="title">${i18n("latency")}</div>
				</media-chrome-menu>
			</media-settings-menu-item>
		</media-settings-menu>`;
	}

	private _debugTemplateEntries(stats: Record<string, StatTypesAll>) {
		return Object.values(stats).map((val) => {
			const label = html`<span class="debugLabel"
				>${i18n(val.key)}</span
			>`;
			switch (val.type) {
				case "graph":
					return html`${label}<debug-graph
							maxEntries=${StreamPlayer.STATS_MAX_HISTORY}
							.values=${val.history}
							fillColor="${val.graphColor}"
							backgroundColor="${val.backgroundColor}"
							?stdDevScale=${val.stdDevScale}
						>
							<span>${val.valueString}</span>
						</debug-graph>`;
				case "value":
				default:
					return html`${label}
						<div>${val.value}</div>`;
			}
		});
	}

	private _debugTemplate() {
		return html`<div
				class="debugClose"
				aria-hidden="${this._showDebugStats}"
				role="dialog"
				aria-label="${i18n("debugInfo")}"
				aria-modal="false"
			>
				<div
					class="debugCloseButton"
					role="button"
					tabindex="0"
					aria-pressed="false"
					aria-label="${i18n("close")}"
					focusable="${this._showDebugStats}"
					aria-hidden="${this._showDebugStats}"
					@click="${() => {
						this._showDebugStats = false;
						this._debugStats = {};
						if (this._streamReader) {
							this._streamReader.setDebugState(
								this._showDebugStats,
							);
						}
					}}"
					@keydown="${(e: KeyboardEvent) => {
						if (e.key === "Enter" || e.key === " ") {
							this._showDebugStats = false;
							this._debugStats = {};
							if (this._streamReader) {
								this._streamReader.setDebugState(
									this._showDebugStats,
								);
							}
						}
					}}"
				>
					<svg
						viewBox="0 0 11 11"
						transform="translate(-5.5 2.25) rotate(45, 5.5, 5.5)"
						width="100%"
						height="100%"
					>
						<rect
							width="100%"
							height="1"
							y="5"
							fill="var(--fg-color)"
						/>
						<rect
							width="1"
							height="100%"
							x="5"
							fill="var(--fg-color)"
						/>
					</svg>
				</div>
			</div>
			<div class="debugInner">
				${Object.values(this._debugStats).length +
					Object.values(this._globalStats).length >
				0
					? this._debugTemplateEntries(this._globalStats).concat(
							this._debugTemplateEntries(this._debugStats),
						)
					: html`<div>${i18n("statsUnavailable")}</div>`}
			</div>`;
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
			touch-action: none;
			padding: 20px;
			box-sizing: border-box;
			opacity: 100% !important;
			user-select: none;
			-webkit-touch-callout: none;
			-webkit-user-select: none;
			-ms-user-select: none;
			-moz-user-select: none;
		}
		.error.active .errorContent {
			padding: 10px;
			background: var(--overlay-bg-color);
			border-radius: var(--border-radius);
			line-height: initial;
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

		.debugWrapper {
			--padding: 5px;
			position: absolute;
			left: 0;
			top: 0;
			width: calc(100% - (2 * var(--padding)));
			height: calc(100% - (2 * var(--padding)));
			max-width: 100svw;
			max-height: 100svh;
			display: flex;
			align-items: flex-start;
			color: var(--fg-color);
			pointer-events: none;
			touch-action: none;
			opacity: 100% !important;
			user-select: none;
			-webkit-touch-callout: none;
			-webkit-user-select: none;
			-ms-user-select: none;
			-moz-user-select: none;
			padding: var(--padding);
		}
		.debug {
			display: none;
			position: relative;
		}
		.debug.active {
			display: flex;
			flex-direction: column;
			background: var(--overlay-bg-color);
			border-radius: var(--border-radius);
			line-height: initial;
			/* backdrop-filter: var(--popup-filter); */
		}
		.debugInner {
			--padding: 10px;
			padding: var(--padding);
			display: grid;
			grid-template-columns: repeat(2, auto);
			--gap: 0.05cm;
			gap: var(--gap);
			grid-column-gap: calc(4 * var(--gap));
		}
		.debugLabel {
			justify-self: end;
		}
		.debugClose {
			--padding: 5px;
			display: flex;
			align-items: flex-start;
			justify-content: flex-end;
			padding-right: var(--padding);
			padding-top: var(--padding);
		}
		.debugCloseButton {
			pointer-events: initial;
			touch-action: initial;
			position: relative;
			cursor: pointer;
			width: 0.4cm;
			height: 0.4cm;
		}
	`;

	render() {
		return html`
			<media-controller
				?gesturesdisabled="${this._errorMessage ? true : false}"
			>
				${this.videoTemplate()}${this.settingsTemplate()}
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
				<div class="debugWrapper">
					<div
						class=${classMap({
							active: this._showDebugStats,
							debug: true,
						})}
					>
						${this._showDebugStats ? this._debugTemplate() : ""}
					</div>
				</div>
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
		`;
	}
}

declare global {
	interface HTMLElementStreamPlayer {
		"stream-player": StreamPlayer;
	}
}
