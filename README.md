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
import { Server } from '@ghostebony/sse/server';

export type ChannelData = {
	'custom-channel-1': {
		id: number;
		date: Date;
		//...
	};
	'custom-channel-2': {
		name: string;
		pattern: RegExp;
		//...
	};
	// ...
};

export const sse = new Server<ChannelData>();
```

`src/routes/sse/+server.ts`

```ts
import { sse } from '$lib/server/sse';
import type { RequestHandler } from './$types';

const room = sse.room('custom-room-name');

export const GET: RequestHandler = (event) =>
	room.server(event.getClientAddress() /* or user unique identifier */, {
		onConnect({ user, close, send }) {
			// ...
		},
		onDisconnect({ user, send }) {
			// ...
		},
	});
```

somewhere on the server

> `send` arguments change its behavior

```ts
import { sse } from '$lib/server/sse';

sse.send({
	room: 'custom-room-name',
	user: userId, // user unique identifier
	id: 1, // message id (optional)
	channel: 'custom-channel-1', // channel that you're listening
	data, // message data (types from ChannelData passed to Server)
});
```

#### client

`src/routes/+(page|layout).svelte`

```svelte
<script lang="ts">
    import { onMount } from "svelte";
    import type { ChannelData } from "$lib/server/sse";
    import { Client } from "@ghostebony/sse/client";

    let eventSource: Client<ChannelData>;

    onMount(() => {
        eventSource = new Client(
            { url: "/sse" },
            {
                "custom-channel-1": {
                    listener({ data }) {
						// ...
                    },
                },
                // ...
            },
        );

        return () => eventSource?.close();
    });
</script>
```
