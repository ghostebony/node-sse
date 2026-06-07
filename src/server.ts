import { stringify } from 'devalue';
import type {
	Channel,
	ChannelData,
	Controller,
	ControllerEvents,
	Encode,
	Expand,
	Message,
	MessageGeneric,
	MessageMultiRoom,
	MessageMultiRoomEveryone,
	MessageRoom,
	MessageRoomEveryone,
	MessageUser,
	OnAction,
	RoomName,
	RoomOptions,
	SendOptions,
	User,
} from './types';

const encoder = new TextEncoder();

//#region Storage
abstract class Storage {
	public static readonly rooms = new Map<RoomName, Room<ChannelData, User>>();
}

function _message(message: Message<ChannelData, Channel>, encode: Encode) {
	return encoder.encode(
		`${message.id ? `id: ${message.id}\n` : ''}event: ${message.channel}\ndata: ${encode(message.data)}\n\n`,
	);
}

//#region StreamController
class StreamController<TChannelData extends ChannelData, TUser extends User> {
	public controller!: Controller;

	public readonly encode: Encode = stringify;

	public readonly pingInterval = 10 * 60000;

	#ping: ReturnType<typeof setInterval> | undefined;

	#onAction!: Parameters<OnAction<TChannelData, TUser>>[0];

	#onMessage: ControllerEvents<TChannelData, TUser>['onMessage'] | undefined = undefined;

	constructor(
		public user: TUser,
		private onStart: (user: TUser, controller: StreamController<TChannelData, TUser>) => void,
		private onCancel: (user: TUser, controller: StreamController<TChannelData, TUser>) => void,
		options?: Expand<RoomOptions>,
	) {
		if (options) {
			if (options.encode) {
				this.encode = options.encode;
			}

			if (options.pingInterval) {
				this.pingInterval = options.pingInterval;
			}
		}
	}

	//#region init
	public init(events?: Expand<ControllerEvents<TChannelData, TUser>>): UnderlyingSource<unknown> {
		this.#onAction = {
			user: this.user,
			close: () => {
				this.cancel();
			},
			send: <TChannel extends Channel>(
				message: Message<TChannelData, TChannel>,
				options?: SendOptions,
			) => {
				this.send(message, options);
			},
		};

		this.#onMessage = events?.onMessage;

		return {
			start: async (ctrl) => {
				this.controller = ctrl;

				this.sendPing();

				this.onStart(this.user, this);

				events?.onConnect?.(this.#onAction);

				clearInterval(this.#ping);

				this.#ping = setInterval(() => {
					try {
						this.sendPing();
					} catch {
						clearInterval(this.#ping);

						this.cancel(events?.onDisconnect);
					}
				}, this.pingInterval);
			},
			cancel: () => {
				this.cancel(events?.onDisconnect);
			},
		};
	}

	//#region cancel
	public cancel(onDisconnect?: ControllerEvents<TChannelData, TUser>['onDisconnect']): void {
		clearInterval(this.#ping);

		onDisconnect?.({ user: this.user, send: this.#onAction.send });

		try {
			this.controller.close();
		} catch {}

		this.onCancel(this.user, this);
	}

	//#region send
	public send<TChannel extends Channel>(
		message: Expand<Message<TChannelData, TChannel>>,
		options?: Expand<SendOptions>,
	): void {
		try {
			this.controller.enqueue(_message(message, options?.encode ?? this.encode));

			this.#onMessage?.(
				Object.assign(
					{
						message: message as MessageGeneric<TChannelData, TChannel, TUser>,
						options,
					},
					this.#onAction,
				),
			);
		} catch {}
	}

	//#region sendPing
	protected sendPing(): void {
		this.controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
	}
}

//#region Room
class Room<TChannelData extends ChannelData, TUser extends User> {
	public readonly users = new Map<TUser, Set<StreamController<TChannelData, TUser>>>();

	public readonly encode: Encode = stringify;

	public readonly pingInterval = 10 * 60000;

	public constructor(
		public name: RoomName,
		options?: Expand<RoomOptions>,
	) {
		if (options) {
			if (options.encode) {
				this.encode = options.encode;
			}

			if (options.pingInterval) {
				this.pingInterval = options.pingInterval;
			}
		}
	}

	//#region server
	public server(user: TUser, events?: Expand<ControllerEvents<TChannelData, TUser>>): Response {
		const controller = new StreamController<TChannelData, TUser>(
			user,
			this.controllers.add,
			this.controllers.delete,
			{
				encode: this.encode,
				pingInterval: this.pingInterval,
			},
		).init(events);

		return new Response(new ReadableStream(controller), {
			headers: {
				connection: 'keep-alive',
				'cache-control': 'no-store',
				'content-type': 'text/event-stream',
			},
		});
	}

	//#region controllers
	public controllers = {
		add: (user: TUser, controller: StreamController<TChannelData, TUser>) => {
			let controllers = this.users.get(user);

			if (!controllers) {
				controllers = new Set();

				this.users.set(user, controllers);
			}

			return controllers.add(controller);
		},
		get: (user: TUser) => {
			return this.users.get(user);
		},
		delete: (user: TUser, controller: StreamController<TChannelData, TUser>) => {
			return this.controllers.get(user)?.delete(controller);
		},
	} as const;

	//#region send
	/**
	 * send a message to everyone in this room
	 */
	public send<TChannel extends Channel>(
		message: Expand<Message<TChannelData, TChannel>>,
		options?: Expand<SendOptions>,
	): void;
	/**
	 * send a message to a specific user in this room
	 */
	public send<TChannel extends Channel>(
		message: Expand<MessageUser<TChannelData, TChannel, TUser>>,
		options?: Expand<SendOptions>,
	): void;
	public send<TChannel extends Channel>(
		message: Message<TChannelData, TChannel> | MessageUser<TChannelData, TChannel, TUser>,
		options?: SendOptions,
	): void {
		if ('user' in message) {
			const controllers = this.controllers.get(message.user);

			if (controllers?.size) {
				for (const controller of controllers) {
					try {
						controller.send(message, options);
					} catch {}
				}
			}

			return;
		}

		for (const user of this.users.keys()) {
			this.send({ user, ...message }, options);
		}
	}
}

//#region Server
export class Server<TChannelData extends ChannelData, TUser extends User> {
	//#region room
	/**
	 * if the room already exists, returns the existent room
	 */
	public room(room: RoomName, options?: Expand<RoomOptions>): Room<TChannelData, TUser> {
		if (Storage.rooms.has(room)) {
			return Storage.rooms.get(room) as never;
		}

		const server = new Room<TChannelData, TUser>(room, options);

		Storage.rooms.set(room, server as never);

		return server;
	}

	//#region rooms
	public rooms = {
		has(room: RoomName): boolean {
			return Storage.rooms.has(room);
		},
		get(room: RoomName): Room<TChannelData, TUser> | undefined {
			return Storage.rooms.get(room) as never;
		},
		delete(room: RoomName): boolean {
			return Storage.rooms.delete(room);
		},
	} as const;

	//#region send
	/**
	 * send a message to a specific user in a specific room
	 */
	public send<TChannel extends Channel>(
		message: Expand<MessageRoom<TChannelData, TChannel, TUser>>,
		options?: Expand<SendOptions>,
	): void;
	/**
	 * send a message to everyone in a specific room
	 */
	public send<TChannel extends Channel>(
		message: Expand<MessageRoomEveryone<TChannelData, TChannel>>,
		options?: Expand<SendOptions>,
	): void;
	/**
	 * send a message to a specific user in multiple rooms
	 */
	public send<TChannel extends Channel, TUser extends User>(
		message: Expand<MessageMultiRoom<TChannelData, TChannel, TUser>>,
		options?: Expand<SendOptions>,
	): void;
	/**
	 * send a message to everyone in multiple rooms
	 */
	public send<TChannel extends Channel>(
		message: Expand<MessageMultiRoomEveryone<TChannelData, TChannel>>,
		options?: Expand<SendOptions>,
	): void;
	public send<TChannel extends Channel, TUser extends User>(
		message: MessageGeneric<TChannelData, TChannel, TUser>,
		options?: SendOptions,
	): void {
		if ('room' in message) {
			Storage.rooms.get(message.room)?.send(message, options);

			return;
		}

		for (const room of message.rooms) {
			Storage.rooms.get(room)?.send(message, options);
		}
	}
}
