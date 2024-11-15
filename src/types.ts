/**
 * @internal
 */
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type Decode = (text: string) => any;

export type Encode = (data: any) => string;

export type Listener<T> = {
	listener: (event: MessageEvent<T>) => void;
	decode?: Decode;
};

export type Listeners<T extends ChannelData, K extends keyof T = keyof T> = {
	[TChannel in K]: Listener<T[TChannel]>;
};

export type ChannelData = { [channel: Channel]: any };

export type Controller = ReadableStreamController<unknown>;

export type RoomName = string | number;

export type RoomOptions = {
	/**
	 * @default devalue.stringify
	 */
	encode?: Encode;
	/**
	 * @default 10 * 60000 (every 10 minutes)
	 */
	pingInterval?: number;
};

export type ClientSource = { url: string; init?: EventSourceInit };

export type ClientOptions = {
	decode?: Decode;
	onError?: (this: EventSource, event: globalThis.Event) => any;
	onOpen?: (this: EventSource, event: globalThis.Event) => any;
};

export type ControllerEvents<TChannelData extends ChannelData, TUser extends User> = {
	onConnect?: OnAction<TChannelData, TUser>;
	onMessage?: (
		connection: Expand<
			Parameters<OnAction<TChannelData, TUser>>[0] & {
				message: {
					[K in keyof TChannelData]: Expand<MessageGeneric<TChannelData, K, TUser>>;
				}[keyof TChannelData];
				options?: Expand<SendOptions>;
			}
		>,
	) => void;
	onDisconnect?: (connection: { user: TUser; send: Send<TChannelData> }) => void;
};

export type User = string | number;

export type Channel = string | number;

export type MessageId = string | number;

export type MessageData = Record<string | number, any>;

export type Message<
	TChannelData extends ChannelData,
	TChannel extends keyof TChannelData = keyof TChannelData,
> = {
	id?: MessageId;
	channel: TChannel;
	data: TChannelData[TChannel];
};

export type MessageGeneric<
	TChannelData extends ChannelData,
	TChannel extends keyof TChannelData,
	TUser extends User,
> =
	| MessageRoom<TChannelData, TChannel, TUser>
	| MessageRoomEveryone<TChannelData, TChannel>
	| MessageMultiRoom<TChannelData, TChannel, TUser>
	| MessageMultiRoomEveryone<TChannelData, TChannel>;

export type MessageUser<
	TChannelData extends ChannelData,
	TChannel extends keyof TChannelData,
	TUser extends User,
> = Message<TChannelData, TChannel> & {
	user: TUser;
};

export type MessageRoom<
	TChannelData extends ChannelData,
	TChannel extends keyof TChannelData,
	TUser extends User,
> = MessageUser<TChannelData, TChannel, TUser> & {
	room: RoomName;
};

export type MessageRoomEveryone<
	TChannelData extends ChannelData,
	TChannel extends keyof TChannelData,
> = Message<TChannelData, TChannel> & {
	room: RoomName;
};

export type MessageMultiRoom<
	TChannelData extends ChannelData,
	TChannel extends keyof TChannelData,
	TUser extends User,
> = MessageUser<TChannelData, TChannel, TUser> & {
	rooms: RoomName[];
};

export type MessageMultiRoomEveryone<
	TChannelData extends ChannelData,
	TChannel extends keyof TChannelData,
> = Message<TChannelData, TChannel> & {
	rooms: RoomName[];
};

export type OnAction<TChannelData extends ChannelData, TUser extends User> = (connection: {
	user: TUser;
	/**
	 * close connection
	 */
	close: () => void;
	send: Send<TChannelData>;
}) => void;

export type Send<TChannelData extends ChannelData> = <TChannel extends Channel>(
	message: Message<TChannelData, TChannel>,
	options?: SendOptions,
) => void;

export type SendOptions = {
	encode: Encode;
};
