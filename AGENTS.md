## Important Files

- @docs/DEVELOPMENT.md: detailed development guidelines and instructions, tools, directory tree map, and best practices.
- inc/: contains the main plugin code
- assets/src/: contains the source files for the plugin's assets (e.g., JavaScript, CSS).
- package.json: contains our script commands.

## Important Notes

- Use `wp-env` (v11 parallel environments setup) for local development and testing:

  ```cli
  # Start the governing site (port 8888)
  npm run wp-env start

  # Start the child/brand site (port 8890)
  npm run wp-env:child start

  # Start the test environment (port 8889)
  npm run wp-env:test start

  # Run CLI/Composer commands in the governing site
  npm run wp-env:cli -- composer install

  # Run CLI commands in the child site
  npm run wp-env:child run cli -- --env-cwd=wp-content/plugins/oneupdate {command}

  # Run PHPUnit tests
  npm run test:php
  ```

- Git Hooks & Pre-commit:
  - Lefthook manages the git hooks. You can manually run the pre-commit hook on staged files with:
    ```bash
    npx --no-install lint-staged
    ```
