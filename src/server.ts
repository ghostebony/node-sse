import { stringify as devalueStringify } from "devalue";
import type {
	Channel,
	ChannelData,
	Controller,
	MessageId,
	OnAction,
	RoomName,
	RoomOptions,
	Stringify,
	User,
} from "./types";

const textEncoder = new TextEncoder();

abstract class Storage {
	public static readonly rooms = new Map<RoomName, Room<any>>();
}

class Room<T extends ChannelData> {
	public readonly users = new Map<User, Set<Controller>>();

	public readonly stringify: Stringify = devalueStringify;

	public readonly pingInterval = 10 * 60000;

	public constructor(
		public name: RoomName,
		options?: RoomOptions,
	) {
		if (options) {
			if (options.stringify) {
				this.stringify = options.stringify;
			}

			if (options.pingInterval) {
				this.pingInterval = options.pingInterval;
			}
		}
	}

	public server<TUser extends User>(
		user: TUser,
		on?: {
			connect?: OnAction<TUser>;
			disconnect?: OnAction<TUser>;
		},
	): Response {
		return new Response(new ReadableStream(this.controller(user, on)), {
			headers: {
				connection: "keep-alive",
				"cache-control": "no-store",
				"content-type": "text/event-stream",
			},
		});
	}

	private controller<TUser extends User>(
		user: TUser,
		on?: {
			connect?: OnAction<TUser>;
			disconnect?: OnAction<TUser>;
		},
	): UnderlyingSource<unknown> {
		let controller: Controller;
		let ping: ReturnType<typeof setInterval>;

		return {
			start: async (ctrl) => {
				controller = ctrl;

				this.ping(controller);

				this.addController(user, controller);

				on?.connect?.({ user, controller });

				ping = setInterval(() => {
					try {
						this.ping(controller);
					} catch {
						clearInterval(ping);

						this.cancelController(user, controller, on?.disconnect);
					}
				}, this.pingInterval);
			},
			cancel: () => {
				clearInterval(ping);

				this.cancelController(user, controller, on?.disconnect);
			},
		};
	}

	public cancelController<TUser extends User>(
		user: TUser,
		controller: Controller,
		onDisconnect?: OnAction<TUser>,
	) {
		try {
			controller.close();
		} catch {}

		onDisconnect?.({ user, controller });

		this.delController(user, controller);
	}

	private addController<TUser extends User>(user: TUser, controller: Controller) {
		if (!this.users.has(user)) {
			this.users.set(user, new Set());
		}

		return this.users.get(user)!.add(controller);
	}

	private getControllers<TUser extends User>(user: TUser) {
		return this.users.get(user);
	}

	private delController<TUser extends User>(user: TUser, controller: Controller) {
		return this.getControllers(user)?.delete(controller);
	}

	public send<TUser extends User, TChannel extends Channel>(
		userOrController: TUser | Controller,
		id: MessageId,
		channel: TChannel,
		data: T[TChannel],
	) {
		if (typeof userOrController !== "object") {
			const controllers = this.getControllers(userOrController);

			if (controllers) {
				for (const controller of controllers) {
					try {
						controller.enqueue(this.message(id, channel, data));
					} catch {}
				}
			}
		} else {
			try {
				userOrController.enqueue(this.message(id, channel, data));
			} catch {}
		}
	}

	public sendEveryone<TChannel extends Channel>(channel: TChannel, data: T[TChannel]) {
		for (const user of this.users.keys()) {
			this.send(user, null, channel, data);
		}
	}

	protected ping(controller: Controller) {
		return controller.enqueue(textEncoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
	}

	private message<TChannel extends Channel>(id: MessageId, channel: TChannel, data: T[TChannel]) {
		return textEncoder.encode(
			`${id ? `id: ${id}\n` : ""}event: ${channel}\ndata: ${this.stringify(data)}\n\n`,
		);
	}
}

export class Server<T extends ChannelData> {
	/**
	 * if the room already exists, returns the existent room
	 */
	public room(room: RoomName, options?: RoomOptions) {
		if (Storage.rooms.has(room)) {
			return Storage.rooms.get(room)!;
		}

		const server = new Room<T>(room, options);

		Storage.rooms.set(room, server);

		return server;
	}

	public rooms = {
		has(room: RoomName) {
			return Storage.rooms.has(room);
		},
		get(room: RoomName): Room<T> | undefined {
			return Storage.rooms.get(room);
		},
		delete(room: RoomName) {
			return Storage.rooms.delete(room);
		},
	} as const;

	public sendRoom<TUser extends User, TChannel extends Channel>(
		room: RoomName,
		user: TUser,
		id: MessageId,
		channel: TChannel,
		data: T[TChannel],
	) {
		return Storage.rooms.get(room)?.send(user, id, channel, data);
	}

	public sendRoomEveryone<TChannel extends Channel>(
		room: RoomName,
		channel: TChannel,
		data: T[TChannel],
	) {
		return Storage.rooms.get(room)?.sendEveryone(channel, data);
	}

	public sendMultiRoomChannel<TUser extends User, TChannel extends Channel>(
		rooms: RoomName[],
		user: TUser,
		id: MessageId,
		channel: TChannel,
		data: T[TChannel],
	) {
		for (const room of rooms) {
			Storage.rooms.get(room)?.send(user, id, channel, data);
		}
	}

	public sendEveryoneMultiRoomChannel<TChannel extends Channel>(
		rooms: RoomName[],
		channel: TChannel,
		data: T[TChannel],
	) {
		for (const room of rooms) {
			Storage.rooms.get(room)?.sendEveryone(channel, data);
		}
	}
}

export { Server as Servinator };
