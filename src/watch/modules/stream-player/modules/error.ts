import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("player-error")
export class PlayerError extends LitElement {
	constructor() {
		super();
	}

	@property({ type: Boolean })
	public visible: boolean = false;

	static styles = css`
		.wrapper {
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
		.wrapper.active .content {
			padding: 10px;
			background: var(--overlay-bg-color);
			border-radius: var(--border-radius);
			line-height: initial;
			/* backdrop-filter: var(--popup-filter); */
		}
	`;

	render() {
		return html`<div
			class=${classMap({
				active: this.visible,
				wrapper: true,
			})}
			aria-hidden="${this.visible}"
			aria-modal="${this.visible}"
		>
			<span class="content"><slot></slot></span>
		</div>`;
	}
}

declare global {
	interface HTMLElementPlayerError {
		"player-error": PlayerError;
	}
}
