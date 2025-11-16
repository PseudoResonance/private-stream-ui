import { css, html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { PagePanelHeader } from "../header";

@customElement("header-text")
export class HeaderText extends LitElement {
	constructor() {
		super();
	}

	connectedCallback() {
		super.connectedCallback();
		// Allow overriding
		if (this.getAttribute("slot") === null)
			this.setAttribute("slot", PagePanelHeader.slotButtons);
	}

	static styles = css`
		:host {
			height: 100%;
			flex-grow: 0;
			display: flex;
			align-items: center;
			padding: 0 var(--header-button-padding);
		}
		#content {
			background-color: var(--bg-secondary-color);
			border: none;
			font-family: inherit;
			font-size: inherit;
			color: inherit;
			margin: 0;
			text-transform: none;
			height: 100%;
		}
	`;
	render() {
		return html`<slot id="content"></slot>`;
	}
}

declare global {
	interface HTMLElementHeaderText {
		"header-text": HeaderText;
	}
}
