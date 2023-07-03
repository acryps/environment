import { EnvironmentConfiguration } from "./declaration";

export interface SavedConfiguration {
	version: 1;

	projects: {
		[path: string]: {
			active: string;
			settings: {
				[name: string]: EnvironmentConfiguration
			}
		}
	}
}