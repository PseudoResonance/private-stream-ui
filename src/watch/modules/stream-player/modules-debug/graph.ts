import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("debug-graph")
export class DebugGraph extends LitElement {
	private static WIDTH_FACTOR = 4;

	constructor() {
		super();
	}

	@property()
	public maxEntries: number = 50;

	@property()
	public values: number[] = [];

	@property({ type: Boolean })
	public stdDevScale: boolean = false;

	@property()
	public fillColor: string = "white";

	@property()
	public backgroundColor: string = "black";

	private _ctx: CanvasRenderingContext2D | null = null;
	private _canvasHistory: number[] = [];

	firstUpdated() {
		if (!this._ctx) {
			this._ctx = (
				this.shadowRoot?.getElementById("canvas") as HTMLCanvasElement
			).getContext("2d");
			this._canvasHistory = [];
		}
		this._draw();
	}

	private _draw() {
		if (!this._ctx) {
			return;
		}
		if (this._canvasHistory != this.values) {
			const min = this.stdDevScale ? Math.min(...this.values) : 0;
			const max = Math.max(...this.values) - min;
			this._ctx.fillStyle = this.backgroundColor;
			this._ctx.fillRect(
				0,
				0,
				this._ctx.canvas.width,
				this._ctx.canvas.height,
			);
			this._ctx.fillStyle = this.fillColor;
			for (const [i, v] of this.values.entries()) {
				let height;
				if (this.stdDevScale) {
					if (max === 0) {
						height = Math.round(this._ctx.canvas.height / 2);
					} else {
						height = Math.round(
							((v - min) / max) * this._ctx.canvas.height,
						);
					}
				} else {
					if (max === 0) {
						height = this._ctx.canvas.height;
					} else {
						height = Math.round(
							(v / max) * this._ctx.canvas.height,
						);
					}
				}
				height = -Math.max(height, 1);
				this._ctx.fillRect(
					i * DebugGraph.WIDTH_FACTOR,
					this._ctx.canvas.height - 1,
					DebugGraph.WIDTH_FACTOR,
					height,
				);
			}
			this._canvasHistory = this.values;
		}
	}

	static styles = css`
		.wrapper {
			display: flex;
			align-items: center;
			gap: var(--gap);
		}
	`;

	render() {
		this._draw();
		return html`<div class="wrapper">
			<canvas
				id="canvas"
				width="${this.maxEntries * DebugGraph.WIDTH_FACTOR}px"
				height="15px"
			></canvas>
			<slot></slot>
		</div>`;
	}
}

declare global {
	interface HTMLElementDebugGraph {
		"debug-graph": DebugGraph;
	}
}
