export interface Listener {
	channel: string;
	listener: (event: MessageEvent) => any;
	parseJson?: boolean;
	options?: boolean | AddEventListenerOptions;
}

