import { existsSync, readFileSync, writeFileSync } from "fs";
import path, { join } from "path";
import { EnvironmentConfiguration } from "./declaration";
import { homedir } from "os";
import { SavedConfiguration } from "./save";
import { createInterface } from "readline/promises";
import { spawn } from "child_process";
import { sync } from "which";

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

const activeSettings = projectSettings.settings[projectSettings.active];

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

function convertToEnvironmentVariableName(...path: string[]) {
	return path.join('_').replace(/[A-Z]/g, match => `_${match}`).toUpperCase();
}

const environment: Record<string, string> = {};

const inputInterface = createInterface({ 
	input: process.stdin,
	output: process.stdout
});

let saveRequired = false;

async function checkConfiguration(configuration: EnvironmentConfiguration, prefix: string[]) {
	for (let key in configuration) {
		switch (typeof configuration[key]) {
			case 'object': {
				if (!configuration[key]) {
					throw new Error(`${convertToEnvironmentVariableName(...prefix, key)} can't be null`);
				}

				await checkConfiguration(configuration[key] as EnvironmentConfiguration, [...prefix, key]);

				break;
			}

			case 'string': {
				let savedHead = activeSettings;

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

				while (!(name in savedHead) || typeof savedHead[name] != 'string') {
					let response = await inputInterface.question(`${configuration[key]} (${convertToEnvironmentVariableName(...prefix, name)})${defaultValue ? ` [${defaultValue}]` : ''}: `);

					response = response.trim();

					if (defaultValue && !response) {
						response = defaultValue;
					}

					if (isNumber) {
						if (isNaN(+response)) {
							console.error(`${convertToEnvironmentVariableName(...prefix, name)} must be a number`);

							continue;
						}

						response = `${+response}`;
					}

					savedHead[name] = response;
				}

				environment[convertToEnvironmentVariableName(...prefix, name)] = savedHead[name] as string;
				saveRequired = true;

				break;
			}

			default: {
				throw new Error(`${convertToEnvironmentVariableName(...prefix, key)} must be a string or object`);
			}
		}
	}
}

checkConfiguration(environmentConfiguration, []).then(async () => {
	if (saveRequired) {
		writeFileSync(environmentSaveLocation, JSON.stringify(savedEnvironments, null, '\t'));
	}

	switch (childProgram[0]) {
		case '--export-cluster': {
			const applicationFilter = await inputInterface.question('Cluster Application Name: ');
			const environmentFilter = await inputInterface.question('Cluster Environment: ');

			for (let name in environment) {
				process.stdout.write(`vlc2 var set -a ${applicationFilter} -e ${environmentFilter} -n ${JSON.stringify(name)} -v ${JSON.stringify(environment[name])}\n`);
			}

			return;
		}

		default: {
			const programLocation = sync(childProgram[0]);

			// do not inject any variables from our state
			// passing our own properties like 'active setting' would allow developers to add checks to them instead of using the configured environment variables, which is not intended
			const childProcess = spawn(programLocation, childProgram.slice(1), {
				stdio: 'inherit',
				env: {
					...process.env,
					...environment
				}
			});

			childProcess.on('exit', code => {
				process.exit(code ?? 0);
			});
		}
	}
});