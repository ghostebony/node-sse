import type { Listener } from "./types";

export class Client extends EventSource {
	public constructor({
		eventSource,
		listeners,
		on,
	}: {
		eventSource: { url: string; eventSourceInitDict?: EventSourceInit };
		listeners: Listener[];
		on?: {
			error?: (this: EventSource, event: globalThis.Event) => any;
			open?: (this: EventSource, event: globalThis.Event) => any;
			message?: Exclude<Listener, "channel" | "options">;
		};
	}) {
		super(eventSource.url, eventSource.eventSourceInitDict);

		for (const { channel, listener, parseJson, options } of listeners) {
			this.addEventListener(
				channel,
				(e) =>
					listener({
						...e,
						data: parseJson ? JSON.parse(e.data) : e.data,
					}),
				options
			);
		}

		this.onerror = on?.error ?? null;

		this.onopen = on?.open ?? null;

		if (on?.message) {
			this.onmessage = (e) =>
				on.message?.listener({
					...e,
					data: on.message.parseJson ? JSON.parse(e.data) : e.data,
				});
		}
	}
}
