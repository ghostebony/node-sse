export interface Listener {
	channel: string;
	listener: (event: MessageEvent) => any;
	parseJson?: boolean;
	options?: boolean | AddEventListenerOptions;
}

export type Controller = ReadableStreamController<unknown>;

export type ControllerId = number;

export type Room = string | number;

export type User = string | number;

export type Channel = string | number;

export type MessageId = string | number;

export type MessageData = Record<string | number, any>;

export type OnAction = (connection: { user: User; controller: Controller }) => any;
