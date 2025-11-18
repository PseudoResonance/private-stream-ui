export interface BackendConfig {
	thumbnailUrl?: string;
	webRtcUrl?: string;
	hlsUrl?: string;
}

export interface UserData {
	id?: string;
	name?: string;
	username?: string;
	admin: boolean;
}

export interface ManagementData {
	id?: string;
	baseUrl: string;
	publishProtocols?: Record<string, number>;
	providerBase: string;
	thumbnailUrlNoToken: string;
}
