import { convertToEnvironmentVariableName } from "./convert";
import { EnvironmentConfiguration } from "./declaration";

interface WalkedNode {
	name: string;
	isNumber: boolean;
	currentValue: string;
	defaultValue?: string;
	environmentName: string;
}

export class ConfigurationChain {
	environment: Record<string, string> = {};

	constructor(
		private activeSettings: EnvironmentConfiguration
	) {}

	async walk(configuration: EnvironmentConfiguration, transform: (node: WalkedNode) => Promise<string | undefined>) {
		return await this.walkBranch(configuration, transform, []);
	}

	private async walkBranch(configuration: EnvironmentConfiguration, transform: (node: WalkedNode) => Promise<string | undefined>, prefix: string[]) {
		for (let key in configuration) {
			switch (typeof configuration[key]) {
				case 'object': {
					if (!configuration[key]) {
						throw new Error(`${convertToEnvironmentVariableName(...prefix, key)} can't be null`);
					}
	
					await this.walkBranch(configuration[key] as EnvironmentConfiguration, transform, [...prefix, key]);
	
					break;
				}
	
				case 'string': {
					let savedHead = this.activeSettings;
	
					for (let part of prefix) {
						if (!savedHead[part] || typeof savedHead[part] == 'string') {
							savedHead[part] = {};
						}
	
						savedHead = savedHead[part] as EnvironmentConfiguration;
					}
	
					let name = key;
	
					let isNumber = false;
					let defaultValue;
	
					if (name.includes('+')) {
						isNumber = true;
	
						name = name.replace('+', '');
					}
	
					if (name.includes('?')) {
						defaultValue = name.split('?')[1];
						name = name.split('?')[0];
					}
	
					const transformed = await transform({
						name: configuration[key] as string,
						isNumber,
						currentValue: savedHead[name] as string,
						defaultValue,
						environmentName: convertToEnvironmentVariableName(...prefix, name)
					});
	
					if (transformed === undefined) {
						delete savedHead[name];
					} else {
						savedHead[name] = transformed;
					}
	
					this.environment[convertToEnvironmentVariableName(...prefix, name)] = savedHead[name] as string;
	
					break;
				}
	
				default: {
					throw new Error(`${convertToEnvironmentVariableName(...prefix, key)} must be a string or object`);
				}
			}
		}
	}
}