export type Decode = (text: string) => any;

export type Encode = (data: any) => string;

export type Listener<T> = {
	listener: (event: MessageEvent<T>) => void;
	decode?: Decode;
};

export type Listeners<T extends ChannelData, K extends keyof T = keyof T> = {
	[TChannel in K]: Listener<T[TChannel]>;
};

export type ChannelData = { [channel: string]: any };

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
	onDisconnect?: (connection: { user: TUser; send: Send<TChannelData> }) => void;
};

export type User = string | number;

export type Channel = string | number;

export type MessageId = string | number;

export type MessageData = Record<string | number, any>;

export type Message<TChannelData extends ChannelData, TChannel extends Channel> = {
	id?: MessageId;
	channel: TChannel;
	data: TChannelData[TChannel];
};

export type MessageUser<
	TChannelData extends ChannelData,
	TChannel extends Channel,
	TUser extends User,
> = Message<TChannelData, TChannel> & {
	user: TUser;
};

export type MessageRoom<
	TChannelData extends ChannelData,
	TChannel extends Channel,
	TUser extends User,
> = MessageUser<TChannelData, TChannel, TUser> & {
	room: RoomName;
};

export type MessageRoomEveryone<
	TChannelData extends ChannelData,
	TChannel extends Channel,
> = Message<TChannelData, TChannel> & {
	room: RoomName;
};

export type MessageMultiRoomChannel<
	TChannelData extends ChannelData,
	TChannel extends Channel,
	TUser extends User,
> = MessageUser<TChannelData, TChannel, TUser> & {
	rooms: RoomName[];
};

export type MessageEveryoneMultiRoomChannel<
	TChannelData extends ChannelData,
	TChannel extends Channel,
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
}) => any;

export type Send<TChannelData extends ChannelData> = <TChannel extends Channel>(
	message: Message<TChannelData, TChannel>,
	options?: SendOptions,
) => void;

export type SendOptions = {
	encode: Encode;
};
