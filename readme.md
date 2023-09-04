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

## Modifiers
Modifiers may be added to the names in the package configuration
- `…?default`: Set a default value which will be accepted when the user does not provide a value
- `+…`: Require a numeric value

Adding an uppercase letter in the variables name will automatically be expanded with a `_`: `accessKey` → `ACCESS_KEY`

## Exporting
The current configuration can be exported in various formats for import into other applications

```
npx environment --export # exports as environment bundle, for import into environment
npx environment --export-json # exports as json
npx environment --export-shell # exports as NAME="VALUE" statements for shell scripts
npx environment --export-dotenv # exports as export NAME="VALUE" statements for .env files
npx environment --export-cluster # exports as vlcluster variable commands
```