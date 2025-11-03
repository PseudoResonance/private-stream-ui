import { html, css, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { VideoState } from "./types.ts";

import "./button.ts";
import { StreamProtocol } from "./protocols/index.ts";

@customElement("player-controls")
export class PlayerControls extends LitElement {
	@property({ type: Boolean })
	active: boolean = false;
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

	@state()
	private _settingsActive: boolean = false;

	private static updateTimerTimeout = 1000;

	private _updateTimer: NodeJS.Timeout | undefined = undefined;

	constructor() {
		super();
		window.addEventListener(
			"click",
			(e) => {
				const settingsElem =
					this.shadowRoot?.getElementById("player-settings");
				if (
					settingsElem?.getBoundingClientRect() &&
					!(
						e.pageX >= settingsElem?.getBoundingClientRect().x &&
						e.pageX <=
							settingsElem?.getBoundingClientRect().x +
								settingsElem?.getBoundingClientRect().width &&
						e.pageY >= settingsElem?.getBoundingClientRect().y &&
						e.pageY <=
							settingsElem?.getBoundingClientRect().y +
								settingsElem?.getBoundingClientRect().height
					)
				) {
					if (this._settingsActive) {
						this._settingsActive = false;
					}
				}
				// if (
				// 	!settingsElem?.contains(
				// 		(e as any).explicitOriginalTarget as Node,
				// 	) &&
				// 	this._settingsActive
				// ) {
				// 	this._settingsActive = false;
				// }
			},
			{ capture: true },
		);
	}

	static styles = css`
		:host {
			--control-bar-height: 1cm;
			display: grid;
			grid-template-columns: [start] 1fr [end];
			grid-template-rows:
				[start] 1fr [control-bar] var(--control-bar-height)
				[end];
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
			backdrop-filter: var(--popup-filter);
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
			backdrop-filter: var(--popup-filter);
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
				class="controlBar ${(this.active || this._settingsActive) &&
				!this.disabled
					? "active"
					: "inactive"}"
			>
				<player-controls-button
					action="${this.videoState.playing ? "pause" : "play"}"
					@click="${() => {
						this.updateVideoState({
							playing: !this.videoState.playing,
						});
					}}"
				></player-controls-button>
				<div class="spacer"></div>
				<player-controls-button
					action="settings"
					@click="${() => {
						this._settingsActive = !this._settingsActive;
					}}"
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
				></player-controls-button>
			</div>`;
	}
}

declare global {
	interface HTMLElementPlayerControls {
		"player-controls": PlayerControls;
	}
}
