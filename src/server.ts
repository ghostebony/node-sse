import { stringify } from "devalue";
import type {
	Channel,
	ChannelData,
	Controller,
	ControllerEvents,
	Encode,
	Message,
	MessageEveryoneMultiRoomChannel,
	MessageMultiRoomChannel,
	MessageRoom,
	MessageRoomEveryone,
	MessageUser,
	OnAction,
	RoomName,
	RoomOptions,
	SendOptions,
	User,
} from "./types";

const encoder = new TextEncoder();

abstract class Storage {
	public static readonly rooms = new Map<RoomName, Room<ChannelData, User>>();
}

function _message(message: Message<ChannelData, Channel>, encode: Encode) {
	return encoder.encode(
		`${message.id ? `id: ${message.id}\n` : ""}event: ${message.channel}\ndata: ${encode(message.data)}\n\n`,
	);
}

export class StreamController<TChannelData extends ChannelData, TUser extends User = User> {
	public controller!: Controller;

	public readonly encode: Encode = stringify;

	public readonly pingInterval = 10 * 60000;

	private ping!: ReturnType<typeof setInterval>;

	private onAction!: Parameters<OnAction<TChannelData, TUser>>[0];

	constructor(
		public user: TUser,
		private onStart: (user: TUser, controller: StreamController<TChannelData, TUser>) => void,
		private onCancel: (user: TUser, controller: StreamController<TChannelData, TUser>) => void,
		options?: RoomOptions,
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

	public init(events?: ControllerEvents<TChannelData, TUser>): UnderlyingSource<unknown> {
		this.onAction = {
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

		return {
			start: async (ctrl) => {
				this.controller = ctrl;

				this.sendPing();

				this.onStart(this.user, this);

				events?.onConnect?.(this.onAction);

				clearInterval(this.ping);

				this.ping = setInterval(() => {
					try {
						this.sendPing();
					} catch {
						clearInterval(this.ping);

						this.cancel(events?.onDisconnect);
					}
				}, this.pingInterval);
			},
			cancel: () => {
				this.cancel(events?.onDisconnect);
			},
		};
	}

	public cancel(onDisconnect?: ControllerEvents<TChannelData, TUser>["onDisconnect"]) {
		clearInterval(this.ping);

		onDisconnect?.({ user: this.user, send: this.onAction.send });

		try {
			this.controller.close();
		} catch {}

		this.onCancel(this.user, this);

	}

	public send<TChannel extends Channel>(
		message: Message<TChannelData, TChannel>,
		options?: SendOptions,
	) {
		try {
			this.controller.enqueue(_message(message, options?.encode ?? this.encode));
		} catch {}
	}

	protected sendPing() {
		return this.controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
	}
}

class Room<TChannelData extends ChannelData, TUser extends User = User> {
	public readonly users = new Map<TUser, Set<StreamController<TChannelData, TUser>>>();

	public readonly encode: Encode = stringify;

	public readonly pingInterval = 10 * 60000;

	public constructor(
		public name: RoomName,
		options?: RoomOptions,
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

	public server(user: TUser, events?: ControllerEvents<TChannelData, TUser>): Response {
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
				connection: "keep-alive",
				"cache-control": "no-store",
				"content-type": "text/event-stream",
			},
		});
	}

	public controllers = {
		add: (user: TUser, controller: StreamController<TChannelData, TUser>) => {
			if (!this.users.has(user)) {
				this.users.set(user, new Set());
			}

			return this.users.get(user)!.add(controller);
		},
		get: (user: TUser) => {
			return this.users.get(user);
		},
		delete: (user: TUser, controller: StreamController<TChannelData, TUser>) => {
			return this.controllers.get(user)?.delete(controller);
		},
	} as const;

	public send<TChannel extends Channel>(
		message: MessageUser<TChannelData, TChannel, TUser>,
		options?: SendOptions,
	) {
		const controllers = this.controllers.get(message.user);

		if (controllers) {
			for (const controller of controllers) {
				try {
					controller.send(message, options);
				} catch {}
			}
		}
	}

	public sendEveryone<TChannel extends Channel>(
		message: Message<TChannelData, TChannel>,
		options?: SendOptions,
	) {
		for (const user of this.users.keys()) {
			this.send({ user, ...message }, options);
		}
	}
}

export class Server<TChannelData extends ChannelData, TUser extends User = User> {
	/**
	 * if the room already exists, returns the existent room
	 */
	public room(room: RoomName, options?: RoomOptions): Room<TChannelData, TUser> {
		if (Storage.rooms.has(room)) {
			return Storage.rooms.get(room)! as any;
		}

		const server = new Room<TChannelData, TUser>(room, options);

		Storage.rooms.set(room, server as any);

		return server;
	}

	public rooms = {
		has(room: RoomName) {
			return Storage.rooms.has(room);
		},
		get(room: RoomName): Room<TChannelData, TUser> | undefined {
			return Storage.rooms.get(room) as any;
		},
		delete(room: RoomName) {
			return Storage.rooms.delete(room);
		},
	} as const;

	public sendRoom<TChannel extends Channel>(
		message: MessageRoom<TChannelData, TChannel, TUser>,
		options?: SendOptions,
	) {
		return Storage.rooms.get(message.room)?.send(message, options);
	}

	public sendRoomEveryone<TChannel extends Channel>(
		message: MessageRoomEveryone<TChannelData, TChannel>,
		options?: SendOptions,
	) {
		return Storage.rooms.get(message.room)?.sendEveryone(message, options);
	}

	public sendMultiRoomChannel<TUser extends User, TChannel extends Channel>(
		message: MessageMultiRoomChannel<TChannelData, TChannel, TUser>,
		options?: SendOptions,
	) {
		for (const room of message.rooms) {
			Storage.rooms.get(room)?.send(message, options);
		}
	}

	public sendEveryoneMultiRoomChannel<TChannel extends Channel>(
		message: MessageEveryoneMultiRoomChannel<TChannelData, TChannel>,
		options?: SendOptions,
	) {
		for (const room of message.rooms) {
			Storage.rooms.get(room)?.sendEveryone(message, options);
		}
	}
}
