import { parse } from "devalue";
import type { ChannelData, ClientOptions, Decode, Listeners } from "./types";

export class Client<T extends ChannelData> {
	public readonly source: EventSource;

	public readonly decode: Decode;

	private listeners: { [channel: string]: (e: MessageEvent<any>) => void } = {};

	public constructor(
		source: { url: string; init?: EventSourceInit },
		listeners: Listeners<T>,
		options?: ClientOptions,
	) {
		this.source = new EventSource(source.url, source.init);

		this.decode = options?.decode ?? parse;

		for (const channel in listeners) {
			const { listener, decode } = listeners[channel];

			this.listeners[channel] = (e) => {
				listener(
					Object.assign(
						{
							data: (decode ?? this.decode)(e.data),
						},
						e,
					),
				);
			};

			this.source.addEventListener(channel, this.listeners[channel]);
		}

		this.source.onerror = options?.onError ?? null;

		this.source.onopen = options?.onOpen ?? null;
	}

	public close() {
		for (const channel in this.listeners) {
			this.source.removeEventListener(channel, this.listeners[channel]);
		}

		this.source.close();

		this.listeners = {};
	}
}
