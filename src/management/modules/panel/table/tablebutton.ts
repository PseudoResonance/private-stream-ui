import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { GridTable } from "./gridtable";

@customElement("table-button")
export class TableButton extends LitElement {
	constructor() {
		super();
	}

	connectedCallback() {
		super.connectedCallback();
		// Allow overriding
		if (this.getAttribute("slot") === null)
			this.setAttribute("slot", GridTable.slotButtons);
	}

	static styles = css`
		:host {
			height: 100%;
			flex-grow: 0;
			--table-button-padding: 0.3cm;
			font-weight: bold;
			--bg-color: var(--bg-secondary-color);
			--bg-color-hover: var(--bg-secondary-color-hover);
			--fg-color: var(--fg-primary-color);
		}
		h1,
		h2,
		h3,
		h4,
		h5,
		h6 {
			margin: 0;
		}
		button,
		[type="button"],
		[type="reset"],
		[type="submit"] {
			-webkit-appearance: button;
		}
		button {
			background-color: var(--bg-color);
			color: var(--fg-color);
			border: none;
			font-family: inherit;
			font-size: inherit;
			color: inherit;
			padding: 0 var(--table-button-padding);
			margin: 0;
			text-transform: none;
			height: 100%;
			transition: background-color var(--transition-speed)
				var(--transition-function);
			cursor: pointer;
		}
		button::-moz-focus-inner {
			border: 0;
			padding: 0;
		}
		button:hover,
		button:focus {
			background-color: var(--bg-color-hover);
		}
	`;

	render() {
		return html`<button type="button">
			<h3><slot></slot></h3>
		</button>`;
	}
}

declare global {
	interface HTMLElementTableButton {
		"table-button": TableButton;
	}
}
