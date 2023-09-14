import { parse as devalueParse } from "devalue";
import type { ChannelData, Listeners, Parse } from "./types";

export class Client<T extends ChannelData> {
	public readonly source: EventSource;

	public readonly parse: Parse;

	private listeners: { [channel: string]: (e: MessageEvent<any>) => void } = {};

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

			this.listeners[channel] = (e) => {
				listener(
					Object.assign(
						{
							data: (parse ?? this.parse)(e.data),
						},
						e,
					),
				);
			};

			this.source.addEventListener(
				channel,
				this.listeners[channel],
			);
		}

		this.source.onerror = on?.error ?? null;

		this.source.onopen = on?.open ?? null;
	}

	public close() {
		for (const channel in this.listeners) {
			this.source.removeEventListener(channel, this.listeners[channel]);
		}

		this.source.close();

		this.listeners = {};
	}
}
