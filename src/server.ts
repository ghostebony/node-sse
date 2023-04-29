import type { Channel, Controller, MessageData, MessageId, OnAction, Room, User } from "./types";

const textEncoder = new TextEncoder();

export class Server {
	public users = new Map<User, Set<Controller>>();

	public constructor(public room: Room) {}

	public server = <TUser extends User>(
		user: TUser,
		on?: {
			connect?: OnAction<TUser>;
			disconnect?: OnAction<TUser>;
		}
	) =>
		new Response(new ReadableStream(this.controller(user, on)), {
			headers: {
				connection: "keep-alive",
				"cache-control": "no-store",
				"content-type": "text/event-stream",
			},
		});

	private controller = <TUser extends User>(
		user: TUser,
		on?: {
			connect?: OnAction<TUser>;
			disconnect?: OnAction<TUser>;
		}
	): UnderlyingSource<unknown> => {
		let controller: Controller;
		let ping: ReturnType<typeof setInterval>;

		return {
			start: async (_) => {
				controller = _;

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
				}, 10 * 60000);
			},
			cancel: () => {
				clearInterval(ping);

				this.cancelController(user, controller, on?.disconnect);
			},
		};
	};

	public cancelController = <TUser extends User>(
		user: TUser,
		controller: Controller,
		onDisconnect?: OnAction<TUser>
	) => {
		try {
			controller.close();
		} catch {}

		onDisconnect?.({ user, controller });

		this.delController(user, controller);
	};

	private addController = <TUser extends User>(user: TUser, controller: Controller) => {
		if (!this.users.has(user)) {
			this.users.set(user, new Set());
		}

		return this.users.get(user)!.add(controller);
	};

	private getControllers = <TUser extends User>(user: TUser) => this.users.get(user);

	private delController = <TUser extends User>(user: TUser, controller: Controller) =>
		this.getControllers(user)?.delete(controller);

	public send = <TUser extends User>(
		userOrController: TUser | Controller,
		id: MessageId | null,
		channel: Channel,
		data: MessageData = {}
	) => {
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
	};

	public sendEveryone = (channel: Channel, data?: MessageData) => {
		for (const user of this.users.keys()) {
			this.send(user, null, channel, data);
		}
	};

	protected ping = (controller: Controller) =>
		controller.enqueue(this.message(null, "ping", Date.now()));

	private message = (id: MessageId | null, channel: Channel, data: MessageData | number = {}) =>
		textEncoder.encode(
			`${id ? `id: ${id}\n` : ""}event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`
		);
}

export abstract class ServerManager {
	public static rooms = new Map<Room, Server>();

	public static addRoom = (room: Room) => {
		if (this.hasRoom(room)) {
			return this.getRoom(room)!;
		}

		const server = new Server(room);

		this.rooms.set(room, server);

		return server;
	};

	public static hasRoom = (room: Room) => this.rooms.has(room);

	public static getRoom = (room: Room) => this.rooms.get(room);

	public static delRoom = (room: Room) => this.rooms.delete(room);

	public static sendRoom = <TUser extends User>(
		room: Room,
		user: TUser,
		id: MessageId | null,
		channel: Channel,
		data?: MessageData
	) => this.getRoom(room)?.send(user, id, channel, data);

	public static sendRoomEveryone = (room: Room, channel: Channel, data?: MessageData) =>
		this.getRoom(room)?.sendEveryone(channel, data);

	public static sendMultiRoomChannel = <TUser extends User>(
		rooms: Room[],
		user: TUser,
		id: MessageId | null,
		channel: Channel,
		data?: MessageData
	) => {
		for (const room of rooms) {
			this.rooms.get(room)?.send(user, id, channel, data);
		}
	};

	public static sendEveryoneMultiRoomChannel = (
		rooms: Room[],
		channel: Channel,
		data?: MessageData
	) => {
		for (const room of rooms) {
			this.rooms.get(room)?.sendEveryone(channel, data);
		}
	};
}
