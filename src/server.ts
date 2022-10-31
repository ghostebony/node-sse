import type { Channel, Controller, MessageData, MessageId, OnAction, Room, User } from "./types";

export class Server {
	public users = new Map<User, Set<Controller>>();

	public constructor(public room: Room) {}

	public server = (
		user: User,
		on?: {
			connect?: OnAction;
			disconnect?: OnAction;
		}
	) =>
		new Response(new ReadableStream(this.controller(user, on)), {
			headers: {
				connection: "keep-alive",
				"cache-control": "no-store",
				"content-type": "text/event-stream",
			},
		});

	private controller = (
		user: User,
		on?: {
			connect?: OnAction;
			disconnect?: OnAction;
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

	public cancelController = (user: User, controller: Controller, onDisconnect?: OnAction) => {
		try {
			controller.close();
		} catch {}

		onDisconnect?.({ user, controller });

		this.delController(user, controller);
	};

	private addController = (user: User, controller: Controller) => {
		if (!this.users.has(user)) {
			this.users.set(user, new Set());
		}

		return this.users.get(user)!.add(controller);
	};

	private getControllers = (user: User) => this.users.get(user);

	private delController = (user: User, controller: Controller) =>
		this.getControllers(user)?.delete(controller);

	public send = (
		userOrController: User | Controller,
		id: MessageId | null,
		channel: Channel,
		data: MessageData = {}
	) => {
		if (typeof userOrController === "string" || typeof userOrController === "number") {
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

	public ping = (controller: Controller) =>
		controller.enqueue(this.message(null, "ping", Date.now()));

	private message = (id: MessageId | null, channel: Channel, data: MessageData | number = {}) =>
		`${id ? `id: ${id}\n` : ""}event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`;
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

	public static sendMultiRoomChannel = (
		rooms: Room[],
		user: User,
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
