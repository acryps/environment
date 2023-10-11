# acryps environment
Environment variable manager for local development

## Getting Started
`npm install @acryps/environment --save-dev`

Active environment by adding `environment` before launching your application in your scripts (will work with any tool)

`tsc && node index.js` → `tsc && environment node index.js`

Define environment variables in your `package.json`
```
{
	"name": "my-application",
	"environment": {
		"host": "Application Host",
		"database": {
			"host": "Database Host",
			"+port?5432": "Database Port"
		}
	}
}
```

You'll automatically be prompted to enter the values required for your project. 
The following environment variables will automatically be passed as environment variables to the application launched by environment:
- `HOST`
- `DATABASE_HOST`
- `DATABASE_PORT`

Access them as usual with `process.env.HOST` - no changes to the code required.
The variables are stored in `~/.a-environment` and is thus outside of your current git directory - You can store secrets too and they will never end up in your git!

## Switching Settings
You may be working on a testing and staging environment. You can quickly switch between different settings in environment, just create a new environment by using 
```
$ npx environment --switch test
```

This will create a new setting 'test', where you can set entirely different environment variables.
You'll automatically be prompted to create new variables when you start your application again.

```
$ npx environment --active-setting # returns the current setting name
$ npx environment --settings # returns all available settings
```

You can switch back to your default setting at any time
```
$ npx environment --switch default
```

You'll need to restart your program whenever you change variables!

## Editing the values
Just use `--edit` with an optional prefix (case insensitive).
You'll be prompted to enter new values, just press enter to take the current value.

```
$ npx environment --edit
$ npx environment --edit database # only database properties
$ npx environment --edit AUTHENTICATION_ENCRYPTION # only authentication → encryption properties
```

## Modifiers
Modifiers may be added to the names in the package configuration
- `…?default`: Set a default value which will be accepted when the user does not provide a value
- `+…`: Require a numeric value

Adding an uppercase letter in the variables name will automatically be expanded with a `_`: `accessKey` → `ACCESS_KEY`

## Exporting / Importing
The current configuration can be exported in various formats for import into other applications.
You can send your current configuration to new team members, and they can quickly import them.

```
$ npx environment --export # exports as environment bundle, for import into environment
$ npx environment --import <blob> # import the environment bundle into the active setting

$ npx environment --export-json # exports as json
$ npx environment --export-shell # exports as NAME="VALUE" statements for shell scripts
$ npx environment --export-dotenv # exports as export NAME="VALUE" statements for .env files
$ npx environment --export-cluster # exports as vlcluster variable commands
$ npx environment --export-kubernetes # exports as kubernetes deployment configuration values
```