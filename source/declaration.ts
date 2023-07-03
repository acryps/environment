export interface EnvironmentConfiguration {
	[name: string]: string | EnvironmentConfiguration;
}