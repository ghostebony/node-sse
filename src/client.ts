import type { Listener } from "./types";

export class Client {
	public readonly source: EventSource;

	public constructor({
		source: { url, init },
		listeners,
		on,
	}: {
		source: { url: string; init?: EventSourceInit };
		listeners: Listener[];
		on?: {
			error?: (this: EventSource, event: globalThis.Event) => any;
			open?: (this: EventSource, event: globalThis.Event) => any;
			message?: Exclude<Listener, "channel" | "options">;
		};
	}) {
		this.source = new EventSource(url, init);

		for (const { channel, listener, parseJson, options } of listeners) {
			this.source.addEventListener(
				channel,
				(e) =>
					listener({
						...e,
						data: parseJson ? JSON.parse(e.data) : e.data,
					}),
				options
			);
		}

		this.source.onerror = on?.error ?? null;

		this.source.onopen = on?.open ?? null;

		if (on?.message) {
			this.source.onmessage = (e) =>
				on.message?.listener({
					...e,
					data: on.message.parseJson ? JSON.parse(e.data) : e.data,
				});
		}
	}

	public close() {
		return this.source.close();
	}
}
