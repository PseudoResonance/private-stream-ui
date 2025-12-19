import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { i18n } from "../../../../../lang";
import "./graph.ts";
import type { StatTypesAll } from "./types.ts";

@customElement("debug-window")
export class DebugWindow extends LitElement {
	constructor() {
		super();
	}

	@property()
	public maxEntries: number = 50;

	@property()
	public setVisible: (state: boolean) => void = () => {};

	@property()
	public stats: StatTypesAll[][] = [];

	static styles = css`
		:host {
			opacity: 100% !important;
		}
		.wrapper {
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
			padding: var(--padding);

			pointer-events: none;
			touch-action: none;
			-webkit-touch-callout: none;

			user-select: none;
			-webkit-user-select: none;
			-ms-user-select: none;
			-moz-user-select: none;
		}
		.debug {
			position: relative;
			display: flex;
			flex-direction: column;
			background: var(--overlay-bg-color);
			border-radius: var(--border-radius);
			line-height: initial;
			/* backdrop-filter: var(--popup-filter); */
		}
		.content {
			--padding: 10px;
			padding: var(--padding);
			display: grid;
			grid-template-columns: repeat(2, auto);
			--gap: 0.05cm;
			grid-row-gap: var(--gap);
			grid-column-gap: calc(4 * var(--gap));

			pointer-events: initial;
			touch-action: initial;
			-webkit-touch-callout: initial;

			user-select: text;
			-webkit-user-select: text;
			-ms-user-select: text;
			-moz-user-select: text;
		}
		.label {
			justify-self: end;
		}
		.closeWrapper {
			--padding: 5px;
			display: flex;
			align-items: flex-start;
			justify-content: flex-end;
			padding-right: var(--padding);
			padding-top: var(--padding);
		}
		.close {
			pointer-events: initial;
			touch-action: initial;
			position: relative;
			cursor: pointer;
			width: 0.4cm;
			height: 0.4cm;
		}
	`;

	private _entries = (stats: StatTypesAll[]) => {
		return stats.map((val) => {
			const label = html`<span class="label">${i18n(val.key)}</span>`;
			switch (val.type) {
				case "graph":
					return html`${label}<debug-graph
							maxEntries=${this.maxEntries}
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
	};

	private _statsEmpty() {
		for (const stats of this.stats) {
			if (Object.values(stats).length > 0) {
				return false;
			}
		}
		return true;
	}

	render() {
		return html`<div class="wrapper">
			<div class="debug">
				<div
					class="closeWrapper"
					role="dialog"
					aria-label="${i18n("debugInfo")}"
					aria-modal="false"
				>
					<div
						class="close"
						role="button"
						tabindex="0"
						aria-pressed="false"
						aria-label="${i18n("close")}"
						focusable="true"
						@click="${() => {
							this.setVisible(false);
						}}"
						@keydown="${(e: KeyboardEvent) => {
							if (e.key === "Enter" || e.key === " ") {
								this.setVisible(false);
							}
						}}"
					>
						<svg viewBox="0 0 11 11" width="100%" height="100%">
							<path
								d="M0.7071 0.7071L10.2929 10.2929"
								stroke="var(--fg-color)"
								stroke-width="1"
							/>
							<path
								d="M10.2929 0.7071L0.7071 10.2929"
								stroke="var(--fg-color)"
								stroke-width="1"
							/>
						</svg>
					</div>
				</div>
				<div class="content">
					${!this._statsEmpty()
						? this.stats.map(this._entries).flat()
						: html`<div>${i18n("statsUnavailable")}</div>`}
				</div>
			</div>
		</div>`;
	}
}

declare global {
	interface HTMLElementDebugWindow {
		"debug-window": DebugWindow;
	}
}
