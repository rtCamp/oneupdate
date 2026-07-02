## Important Files
- @docs/DEVELOPMENT.md: Detailed development guidelines, tools, directory tree map, and best practices.
- inc/: Contains the main plugin PHP code.
- assets/src/: Contains the source files for the plugin's assets (JavaScript, CSS).
- package.json: Contains our script commands.

## Important Notes
Use `wp-env` for local development and testing. Key commands include:
- `npm run wp-env {command}`: Manage the local environment.
- `npm run wp-env:cli {command}`: Run commands inside the local environment's CLI container.
- `npm run wp-env run {container} -- --env-cwd=wp-content/plugins/oneupdate {command}`: Run commands inside a specific container in the plugin directory.
- `npm run wp-env start --xdebug-mode=coverage`: Start local environment with Xdebug enabled.
- `npm run wp-env:cli -- composer install`: Install composer dependencies inside the CLI container.
