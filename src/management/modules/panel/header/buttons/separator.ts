import { css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { ManagementPanelHeader } from "../header";

@customElement("header-separator")
export class HeaderSeparator extends LitElement {
	constructor() {
		super();
	}

	connectedCallback() {
		super.connectedCallback();
		// Allow overriding
		if (this.getAttribute("slot") === null)
			this.setAttribute("slot", ManagementPanelHeader.slotButtons);
	}

	static styles = css`
		:host {
			height: 100%;
			flex-grow: 5;
		}
	`;
}

declare global {
	interface HTMLElementHeaderSeparator {
		"header-separator": HeaderSeparator;
	}
}
