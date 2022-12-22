# @ghostebony/sse

#### client

`src/+(page|layout).svelte`

```svelte
<script>
	import { onMount } from "svelte";
	import { Client } from "@ghostebony/sse/client";

	let eventSource: Client;

	onMount(async () => {
		eventSource = new Client({
			source: { url: "/sse" },
			listeners: [
				{
					channel: "custom-channel",
					listener: ({ data }) => {
						console.log(data);
					},
					parseJson: true,
				}
			],
		});

		return () => {
			eventSource.close();
		};
	});
</script>
```

#### server

`src/sse/+server.ts`

```ts
import { ServerManager } from "@ghostebony/sse/server";
import type { RequestHandler } from "./$types";

const sse = ServerManager.addRoom("custom-room");

export const GET: RequestHandler = (event) =>
	sse.server(event.getClientAddress() /* or user id */, {
		connect: ({ user }) => {
			// DO SOMETHING
		},
		disconnect: ({ user }) => {
			// DO SOMETHING
		},
	});
```

somewhere on the server

```ts
import { ServerManager } from "@ghostebony/sse/server";

ServerManager.sendRoom(
	"custom-room",
	clientAddress /* or user id */,
	1, // message id
	"custom-channel", // channel that you're listening
	data // message data
);
```
