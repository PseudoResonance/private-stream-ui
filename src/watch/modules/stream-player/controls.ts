import { html, css, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { VideoState } from "./types.ts";

import "./button.ts";
import { StreamProtocol } from "./protocols/index.ts";

@customElement("player-controls")
export class PlayerControls extends LitElement {
	@property({ type: Boolean })
	disabled: boolean = false;
	@property({ type: Object })
	videoState: VideoState = {
		playing: false,
		fullscreen: false,
		bufferLength: 2000,
	};
	@property()
	updateVideoState: (stateUpdate: Partial<VideoState>) => void = () => {};
	@property()
	setStreamProtocol: (protocol: StreamProtocol) => void = () => {};
	@property({ type: Number })
	activityTimeout: number = 2000;

	@state()
	private _active: boolean = false;
	@state()
	private _hovering: boolean = false;
	@state()
	private _settingsActive: boolean = false;
	// Check if the last input was touch based for use with the visibility toggle
	@state()
	private _lastInputIsTouch: boolean = false;
	// Toggle visibility state for non mouse input
	@state()
	private _visibilityToggled: boolean = false;

	private static updateTimerTimeout = 1000;

	private _updateTimer: NodeJS.Timeout | undefined = undefined;
	private _activityTimer: NodeJS.Timeout | undefined = undefined;

	constructor() {
		super();
		window.addEventListener(
			"click",
			(e) => {
				const settingsElem =
					this.shadowRoot?.getElementById("player-settings");
				if (
					!settingsElem?.contains(e.composedPath()[0] as Node) &&
					this._settingsActive
				) {
					this._settingsActive = false;
				}
			},
			{ capture: true },
		);
		this.addEventListener("pointerleave", () => {
			clearTimeout(this._activityTimer);
			this._hovering = false;
			this._active = false;
		});
		this.addEventListener("pointermove", (e) => {
			clearTimeout(this._activityTimer);
			this._active = true;
			this._activityTimer = setTimeout(
				this._activityTimerFunc,
				this.activityTimeout,
			);
			if (e.pointerType !== "mouse" && e.pointerType !== "pen") {
				this._lastInputIsTouch = true;
			} else {
				this._lastInputIsTouch = false;
				this._visibilityToggled = false;
			}
		});
		this.addEventListener("click", (e) => {
			if (e.pointerType !== "mouse" && e.pointerType !== "pen") {
				this._lastInputIsTouch = true;
				if (e.composedPath()[0] === this) {
					this._visibilityToggled = !this._visibilityToggled;
				}
			} else {
				this._lastInputIsTouch = false;
				this._visibilityToggled = false;
			}
		});
	}

	private _activityTimerFunc = () => {
		if (!this._hovering) {
			this._active = false;
		}
	};

	private _isControlsVisible = () => {
		return (
			(this._lastInputIsTouch
				? this._visibilityToggled || this._settingsActive
				: this._active || this._settingsActive) && !this.disabled
		);
	};

	static styles = css`
		:host {
			--control-bar-height: 1cm;
			display: grid;
			grid-template-columns: [start] 1fr [end];
			grid-template-rows:
				[start] 1fr [control-bar] var(--control-bar-height)
				[end];
			touch-action: initial;
			pointer-events: initial;
		}
		.spacer {
			margin-left: auto;
			margin-right: auto;
		}
		.controlBar {
			grid-column: start / end;
			grid-row: control-bar / end;
			display: flex;
			background: var(--overlay-bg-color);
			transition: opacity var(--transition-speed)
				var(--transition-function);
			opacity: 100%;
			pointer-events: initial;
			touch-action: initial;
			/* backdrop-filter: var(--popup-filter); */
		}
		.controlBar.inactive {
			opacity: 0%;
			pointer-events: none;
			touch-action: none;
		}
		.wrapper {
			grid-column: start / end;
			grid-row: start / control-bar;
			display: flex;
			align-items: end;
			justify-content: flex-end;
			pointer-events: none;
			touch-action: none;
		}
		.settings {
			color: var(--fg-color);
			--popup-width: 10cm;
			width: min(100%, var(--popup-width));
			opacity: 0%;
			pointer-events: none;
			touch-action: none;
			transition: opacity var(--transition-speed)
				var(--transition-function);
			display: flex;
			flex-direction: column;
			background: var(--overlay-bg-color);
			/* backdrop-filter: var(--popup-filter); */
			--settings-padding: 5px;
			padding: var(--settings-padding);
			align-items: stretch;
		}
		.settings.active {
			pointer-events: initial;
			touch-action: initial;
			opacity: 100%;
		}
		.settings .button {
			padding: 10px;
		}
		.settings .button:hover {
			background: var(--overlay-bg-color);
		}
	`;

	render() {
		return html`<div class="wrapper">
				<div
					id="player-settings"
					class="settings ${this._settingsActive ? "active" : ""}"
				>
					<span class="button slider">
						<label for="buffer-length">Buffer Size</label>
						<input
							id="buffer-length"
							type="range"
							min="0"
							max="4000"
							@input="${(e: InputEvent) => {
								const val = (e.target as HTMLInputElement)
									.value;
								clearTimeout(this._updateTimer);
								this._updateTimer = setTimeout(() => {
									this.updateVideoState({
										bufferLength:
											Number.parseInt(val) === 0
												? null
												: Number.parseInt(val),
									});
								}, PlayerControls.updateTimerTimeout);
							}}"
							value=${this.videoState.bufferLength ?? 0}
						/>
					</span>
					<span
						class="button"
						@click="${() => {
							this.setStreamProtocol(StreamProtocol.WebRTCUDP);
						}}"
						>WebRTC UDP</span
					>
					<span
						class="button"
						@click="${() => {
							this.setStreamProtocol(StreamProtocol.WebRTCTCP);
						}}"
						>WebRTC TCP</span
					>
				</div>
			</div>
			<div
				class="controlBar ${this._isControlsVisible()
					? "active"
					: "inactive"}"
				@pointerenter="${() => {
					this._hovering = true;
				}}"
				@pointerleave="${() => {
					this._hovering = false;
				}}"
			>
				<player-controls-button
					action="${this.videoState.playing ? "pause" : "play"}"
					@click="${() => {
						this.updateVideoState({
							playing: !this.videoState.playing,
						});
					}}"
					aria-label="${this.videoState.playing ? "pause" : "play"}"
				></player-controls-button>
				<div class="spacer"></div>
				<player-controls-button
					action="settings"
					@click="${() => {
						this._settingsActive = !this._settingsActive;
					}}"
					aria-label="settings"
				></player-controls-button>
				<player-controls-button
					action="${this.videoState.fullscreen
						? "minimize"
						: "fullscreen"}"
					@click="${() => {
						this.updateVideoState({
							fullscreen: !this.videoState.fullscreen,
						});
					}}"
					aria-label="${this.videoState.fullscreen
						? "minimize"
						: "fullscreen"}"
				></player-controls-button>
			</div>`;
	}
}

declare global {
	interface HTMLElementPlayerControls {
		"player-controls": PlayerControls;
	}
}
