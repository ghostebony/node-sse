import { stringify } from "devalue";
import type {
	Channel,
	ChannelData,
	Controller,
	ControllerEvents,
	Encode,
	MessageId,
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

function message(id: MessageId, channel: Channel, data: any, encode: Encode) {
	return encoder.encode(`${id ? `id: ${id}\n` : ""}event: ${channel}\ndata: ${encode(data)}\n\n`);
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
				id: MessageId,
				channel: TChannel,
				data: TChannelData[TChannel],
				options?: SendOptions | undefined,
			) => {
				this.send(id, channel, data, options);
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
		id: MessageId,
		channel: TChannel,
		data: TChannelData[TChannel],
		options?: SendOptions,
	) {
		try {
			this.controller.enqueue(message(id, channel, data, options?.encode ?? this.encode));
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
		user: TUser,
		id: MessageId,
		channel: TChannel,
		data: TChannelData[TChannel],
		options?: SendOptions,
	) {
		const controllers = this.controllers.get(user);

		if (controllers) {
			for (const controller of controllers) {
				try {
					controller.send(id, channel, data, options);
				} catch {}
			}
		}
	}

	public sendEveryone<TChannel extends Channel>(
		channel: TChannel,
		data: TChannelData[TChannel],
		options?: SendOptions,
	) {
		for (const user of this.users.keys()) {
			this.send(user, null, channel, data, options);
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
		room: RoomName,
		user: TUser,
		id: MessageId,
		channel: TChannel,
		data: TChannelData[TChannel],
		options?: SendOptions,
	) {
		return Storage.rooms.get(room)?.send(user, id, channel, data, options);
	}

	public sendRoomEveryone<TChannel extends Channel>(
		room: RoomName,
		channel: TChannel,
		data: TChannelData[TChannel],
		options?: SendOptions,
	) {
		return Storage.rooms.get(room)?.sendEveryone(channel, data, options);
	}

	public sendMultiRoomChannel<TUser extends User, TChannel extends Channel>(
		rooms: RoomName[],
		user: TUser,
		id: MessageId,
		channel: TChannel,
		data: TChannelData[TChannel],
		options?: SendOptions,
	) {
		for (const room of rooms) {
			Storage.rooms.get(room)?.send(user, id, channel, data, options);
		}
	}

	public sendEveryoneMultiRoomChannel<TChannel extends Channel>(
		rooms: RoomName[],
		channel: TChannel,
		data: TChannelData[TChannel],
		options?: SendOptions,
	) {
		for (const room of rooms) {
			Storage.rooms.get(room)?.sendEveryone(channel, data, options);
		}
	}
}

export { Server as Servinator };
