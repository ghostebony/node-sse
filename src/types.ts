export type Decode = (text: string) => any;

export type Encode = (data: any) => string;

export type Listener<T> = {
	listener: (event: MessageEvent<T>) => void;
	decode?: Decode;
	// options?: boolean | AddEventListenerOptions;
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

export type ControllerEvents<TUser extends User> = {
	onConnect?: OnAction<TUser>;
	onDisconnect?: OnAction<TUser>;
};

export type SendOptions = {
	encode: Encode;
};

export type User = string | number;

export type Channel = string | number;

export type MessageId = string | number | null;

export type MessageData = Record<string | number, any>;

export type OnAction<TUser extends User> = (connection: {
	user: TUser;
	controller: Controller;
}) => any;
