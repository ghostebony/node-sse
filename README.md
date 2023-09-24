# @ghostebony/sse

## Installation

With npm:

```
npm i @ghostebony/sse@next
```

With yarn:

```
yarn add @ghostebony/sse@next
```

With pnpm:

```
pnpm add @ghostebony/sse@next
```

## Examples

### SvelteKit

#### server

`src/lib/server/sse.ts`

```ts
import { Server } from "@ghostebony/sse/server";

export type ChannelData = {
    "custom-channel-1": { id: number; createdAt: Date; ... };
    "custom-channel-2": { name: string; ... };
    ...
};

export const sse = new Server<ChannelData>();
```

`src/sse/+server.ts`

```ts
import { sse } from "$lib/server/sse";
import type { RequestHandler } from "./$types";

const room = sse.room("custom-room-name");

export const GET: RequestHandler = (event) =>
	room.server(event.getClientAddress() /* or unique identifier */, {
        onConnect({ user }) {
			...
		},
        onDisconnect({ user }) {
			...
		},
	});
```

somewhere on the server

```ts
import { sse } from "$lib/server/sse";

sse.sendRoom(
	"custom-room-name",
	clientAddress /* or unique identifier */,
	1, // message id (can be null)
	"custom-channel-1", // channel that you're listening
	data, // message data (types from ChannelData passed to Server)
);
```

#### client

`src/+(page|layout).svelte`

```svelte
<script lang="ts">
    import { onMount } from "svelte";
    import type { ChannelData } from "$lib/server/sse";
    import { Client } from "@ghostebony/sse/client";

    let eventSource: Client<ChannelData, "custom-channel-1" | ...>;

    onMount(() => {
        eventSource = new Client(
            { url: "/sse" },
            {
                "custom-channel-1": {
                    listener({ data }) {
                        console.log(data);
                    },
                },
                ...
            },
        );

        return () => eventSource?.close();
    });
</script>
```
