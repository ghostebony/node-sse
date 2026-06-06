import { parse } from 'devalue';
import type { ChannelData, ClientOptions, ClientSource, Decode } from './types';

export class Client<
	TChannelData extends ChannelData,
	TChannel extends Extract<keyof TChannelData, string> = Extract<keyof TChannelData, string>,
> {
	public readonly source: EventSource;

	public readonly decode: Decode;

	#listeners = new Map<TChannel, (event: MessageEvent) => void>();

	public constructor(source: ClientSource, options?: ClientOptions) {
		this.source = new EventSource(source.url, source.init);

		this.decode = options?.decode ?? parse;

		this.source.onerror = options?.onError ?? null;

		this.source.onopen = options?.onOpen ?? null;
	}

	public on<T extends TChannel>(
		channel: T,
		callback: (data: TChannelData[T], event: MessageEvent<unknown>) => void,
		options?: {
			decode?: Decode;
		},
	): this {
		const decode = options?.decode ?? this.decode;

		const listener = (event: MessageEvent) => {
			callback(decode(event.data), event);
		};

		this.#listeners.set(channel, listener);

		this.source.addEventListener(channel, listener);

		return this;
	}

	public close(): void {
		for (const [channel, listener] of this.#listeners) {
			this.source.removeEventListener(channel, listener);
		}

		this.source.close();

		this.#listeners.clear();
	}
}
