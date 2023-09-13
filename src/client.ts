import { parse as devalueParse } from "devalue";
import type { ChannelData, Listeners, Parse } from "./types";

export class Client<T extends ChannelData> {
	public readonly source: EventSource;

	public parse: Parse;

	public constructor({
		source: { url, init },
		listeners,
		parse,
		on,
	}: {
		source: { url: string; init?: EventSourceInit };
		listeners: Listeners<T>;
		parse?: Parse;
		on?: {
			error?: (this: EventSource, event: globalThis.Event) => any;
			open?: (this: EventSource, event: globalThis.Event) => any;
		};
	}) {
		this.source = new EventSource(url, init);

		this.parse = parse ?? devalueParse;

		for (const channel in listeners) {
			const { listener, parse } = listeners[channel];

			this.source.addEventListener(
				channel,
				(e) => {
					listener(
						Object.assign(
							{
								data: (parse ?? this.parse)(e.data),
							},
							e,
						),
					);
				},
			);
		}

		this.source.onerror = on?.error ?? null;

		this.source.onopen = on?.open ?? null;
	}

	public close() {
		return this.source.close();
	}
}
