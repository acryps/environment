import { existsSync, readFileSync, writeFileSync } from "fs";
import path, { join } from "path";
import { EnvironmentConfiguration } from "./declaration";
import { homedir } from "os";
import { SavedConfiguration } from "./save";
import { createInterface } from "readline/promises";
import { spawn } from "child_process";
import { sync } from "which";
import { ConfigurationChain } from "./chain";

const childProgram = process.argv.slice(2);

if (!childProgram.length) {
	throw new Error(`No child program set (${process.argv.join(' ')}). Environment cannot be applied`);
}

const environmentSaveLocation = join(homedir(), '.a-environment');

if (!existsSync(environmentSaveLocation)) {
	writeFileSync(environmentSaveLocation, JSON.stringify({
		version: 1,
		projects: {}
	}));
}

let savedEnvironments: SavedConfiguration;

try {
	const save = JSON.parse(readFileSync(environmentSaveLocation).toString());

	savedEnvironments = save;
} catch (error) {
	throw new Error(`Could not read saved environments in '${environmentSaveLocation}': ${error}`);
}

if (savedEnvironments.version != 1) {
	throw new Error(`Invalid saved environments version '${savedEnvironments.version}' in '${environmentSaveLocation}'.`);
}

const projectLocation = process.cwd();

if (!(projectLocation in savedEnvironments.projects)) {
	savedEnvironments.projects[projectLocation] = {
		active: 'default',
		settings: {}
	}
}

const projectSettings = savedEnvironments.projects[projectLocation];

if (!(projectSettings.active in projectSettings.settings)) {
	projectSettings.settings[projectSettings.active] = {};
}

const save = () => {
	writeFileSync(environmentSaveLocation, JSON.stringify(savedEnvironments, null, '\t'));
}

// catch cli commands which do not require variables to be set
switch (childProgram[0]) {
	case '--active-setting': {
		process.stdout.write(`${projectSettings.active}\n`);

		process.exit(0);
	}

	case '--settings': {
		for (let setting in projectSettings.settings) {
			process.stdout.write(`${setting}\n`);
		}
	
		process.exit(0);
	}

	case '--switch': {
		if (childProgram.length != 2) {
			process.stderr.write(`missing arguments\nusage: environment --switch <setting>\nuse 'environment --settings' to list all previously created settings\n`);

			process.exit(1);
		}

		projectSettings.active = childProgram[1].trim();

		if (projectSettings.active in projectSettings.settings) {
			process.stdout.write(`switched to existing setting '${projectSettings.active}'\n`);
		} else {
			process.stdout.write(`switched to new setting '${projectSettings.active}'\n`);
		}

		save();

		process.exit(0);
	}

	case '--import': {
		if (childProgram.length != 2) {
			process.stderr.write(`missing arguments\nusage: environment --import <exported blob>\n`);

			process.exit(1);
		}

		const settings = JSON.parse(Buffer.from(childProgram[1].trim(), 'base64').toString('utf-8'));
		projectSettings.settings[projectSettings.active] = settings;

		save();

		process.stdout.write(`imported into setting '${projectSettings.active}'\n`);

		process.exit(0);
	}
}

const activeSettings = projectSettings.settings[projectSettings.active];
const chain = new ConfigurationChain(activeSettings);

const packageConfigurationLocation = join(projectLocation, 'package.json');

if (!existsSync(packageConfigurationLocation)) {
	throw new Error(`No package.json found in ${projectLocation}`);
}

let environmentConfiguration: EnvironmentConfiguration;

try {
	const packageConfiguration = JSON.parse(readFileSync(packageConfigurationLocation).toString());

	environmentConfiguration = packageConfiguration.environment;
} catch (error) {
	throw new Error(`Could not read package configuration in '${projectLocation}': ${error}`);
}

// fail gracefully if no configuration is available
if (!environmentConfiguration) {
	console.warn(`No environment found in '${packageConfigurationLocation}'`);

	process.exit(0);
}

const inputInterface = createInterface({ 
	input: process.stdin,
	output: process.stdout
});

let saveRequired = false;

// catch cli commands which do not require the environment but not all variables set
switch (childProgram[0]) {
	case '--edit': {
		chain.walk(environmentConfiguration, async node => {
			while (true) {
				let response = await inputInterface.question(`${node.name} (${node.environmentName})${node.currentValue ? ` [${node.currentValue}]` : (node.defaultValue ? ` [${node.defaultValue}]` : '')}: `);
				
				response = response.trim();
		
				if (node.currentValue && !response) {
					return node.currentValue;
				}

				if (node.defaultValue && !response) {
					response = node.defaultValue;
				}
		
				if (node.isNumber) {
					if (isNaN(+response)) {
						console.error(`${node.environmentName} must be a number`);
		
						continue;
					}
		
					response = `${+response}`;
				}
		
				saveRequired = true;
		
				return response;
			}
		}).then(() => {
			save();

			process.exit(0);
		});

		break;
	}

	default: {
		chain.walk(environmentConfiguration, async node => {
			if (node.currentValue) {
				return node.currentValue;
			}

			while (true) {
				let response = await inputInterface.question(`${node.name} (${node.environmentName})${node.defaultValue ? ` [${node.defaultValue}]` : ''}: `);
				
				response = response.trim();
		
				if (node.defaultValue && !response) {
					response = node.defaultValue;
				}
		
				if (node.isNumber) {
					if (isNaN(+response)) {
						console.error(`${node.environmentName} must be a number`);
		
						continue;
					}
		
					response = `${+response}`;
				}
		
				saveRequired = true;
		
				return response;
			}
		}).then(async () => {
			if (saveRequired) {
				save();
			}
		
			// catch cli commands that require variables set
			switch (childProgram[0]) {
				case '--export': {
					process.stdout.write(`environment --import ${Buffer.from(JSON.stringify(activeSettings), 'utf-8').toString('base64')}\n`);
		
					return process.exit(0);
				}
		
				case '--export-json': {
					process.stdout.write(`${JSON.stringify(chain.environment)}\n`);
		
					return process.exit(0);
				}
		
				case '--export-cluster': {
					const applicationFilter = await inputInterface.question('Cluster Application Name: ');
					const environmentFilter = await inputInterface.question('Cluster Environment: ');
		
					for (let name in chain.environment) {
						process.stdout.write(`vlc2 var set -a ${applicationFilter} -e ${environmentFilter} -n ${JSON.stringify(name)} -v ${JSON.stringify(chain.environment[name])}\n`);
					}
		
					return process.exit(0);
				}
		
				case '--export-kubernetes': {
					for (let name in chain.environment) {
						process.stdout.write(`- name: ${JSON.stringify(name)}\n  value: ${JSON.stringify(chain.environment[name])}\n`);
					}
		
					return process.exit(0);
				}
		
				case '--export-shell': {
					for (let name in chain.environment) {
						process.stdout.write(`${name}=${JSON.stringify(chain.environment[name])}\n`);
					}
		
					return process.exit(0);
				}
		
				case '--export-dotenv': {
					for (let name in chain.environment) {
						process.stdout.write(`export ${name}=${JSON.stringify(chain.environment[name])}\n`);
					}
		
					return process.exit(0);
				}
		
				default: {
					const programLocation = sync(childProgram[0]);
		
					// do not inject any variables from our state
					// passing our own properties like 'active setting' would allow developers to add checks to them instead of using the configured environment variables, which is not intended
					const childProcess = spawn(programLocation, childProgram.slice(1), {
						stdio: 'inherit',
						env: {
							...process.env,
							...chain.environment
						}
					});
		
					childProcess.on('exit', code => {
						process.exit(code ?? 0);
					});
				}
			}
		});
	}
}