export interface OSInfo {
	platform: string
	arch: string
	release: string
	type: string
	hostname: string
	userInfo: {
		username: string
		homedir: string
	}
}

export interface System {
	os: OSInfo
}
