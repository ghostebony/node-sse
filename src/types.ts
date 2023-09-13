export type Parse = (text: string) => any;

export type Stringify = (data: any) => string;

export type Listener<T> = {
	listener: (event: MessageEvent<T>) => void;
	parse?: Parse;
	// options?: boolean | AddEventListenerOptions;
};

export type Listeners<T extends ChannelData> = {
	[TChannel in keyof T]: Listener<T[TChannel]>;
};

export type ChannelData = { [channel: string]: any };

export type Controller = ReadableStreamController<unknown>;

export type RoomName = string | number;

export type RoomOptions = {
	/**
	 * @default devalue.stringify
	 */
	stringify?: Stringify;
	/**
	 * @default 10 * 60000 (every 10 minutes)
	 */
	pingInterval?: number;
};

export type User = string | number;

export type Channel = string | number;

export type MessageId = string | number | null;

export type MessageData = Record<string | number, any>;

export type OnAction<TUser extends User> = (connection: {
	user: TUser;
	controller: Controller;
}) => any;
