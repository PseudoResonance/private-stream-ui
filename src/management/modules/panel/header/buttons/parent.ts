import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ManagementPanelHeader } from "../header";

@customElement("header-button")
export class HeaderButton extends LitElement {
	constructor() {
		super();
	}

	@property()
	public href: string = "";

	connectedCallback() {
		super.connectedCallback();
		// Allow overriding
		if (this.getAttribute("slot") === null)
			this.setAttribute("slot", ManagementPanelHeader.slotButtons);
		this.addEventListener("click", () => {
			if (this.href.length > 0) window.location.href = this.href;
		});
	}

	static styles = css`
		:host {
			height: 100%;
			flex-grow: 0;
		}
		button,
		[type="button"],
		[type="reset"],
		[type="submit"] {
			-webkit-appearance: button;
		}
		button {
			background-color: var(--bg-secondary-color);
			border: none;
			font-family: inherit;
			font-size: inherit;
			color: inherit;
			padding: 0 var(--header-button-padding);
			margin: 0;
			text-transform: none;
			height: 100%;
			transition: background-color var(--transition-speed)
				var(--transition-function);
		}
		button::-moz-focus-inner {
			border: 0;
			padding: 0;
		}
		button:hover,
		button:focus {
			background-color: var(--bg-secondary-color-hover);
		}
	`;

	render() {
		return html`<button type="button"><slot></slot></button>`;
	}
}

declare global {
	interface HTMLElementHeaderButton {
		"header-button": HeaderButton;
	}
}
