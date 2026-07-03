<?php
/**
 * OneUpdate
 *
 * @package           OneUpdate
 * @author            rtCamp
 * @copyright         2025 rtCamp
 * @license           GPL-2.0-or-later
 *
 * Plugin Name:       OneUpdate
 * Plugin URI:        https://github.com/rtCamp/OneUpdate/
 * Description:       OneUpdate - Enterprise WordPress Plugin Manager. Automate plugin updates across multiple WordPress sites with CI/CD integration. Creates pull requests for seamless development-to-production workflows.
 * Author:            rtCamp
 * Author URI:        https://rtcamp.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       oneupdate
 * Domain Path:       /languages
 * Version:           1.1.3
 * Requires PHP:      8.1
 * Requires at least: 6.8
 * Tested up to:      6.9
 */

declare( strict_types = 1 );

namespace OneUpdate;

// Exit if accessed directly.
defined( 'ABSPATH' ) || exit;

/**
 * Define the plugin constants.
 */
function constants(): void {
	/**
	 * File path to the plugin's main file.
	 */
	define( 'ONEUPDATE_FILE', __FILE__ );

	/**
	 * Version of the plugin.
	 */
	define( 'ONEUPDATE_VERSION', '1.1.3' );

	/**
	 * Root path to the plugin directory.
	 */
	define( 'ONEUPDATE_DIR', plugin_dir_path( __FILE__ ) );

	/**
	 * Root URL to the plugin directory.
	 */
	define( 'ONEUPDATE_URL', plugin_dir_url( __FILE__ ) );

	/**
	 * The plugin basename.
	 */
	define( 'ONEUPDATE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
}

constants();

// If autoloader fails, we cannot proceed.
require_once __DIR__ . '/inc/Autoloader.php';
if ( ! \OneUpdate\Autoloader::autoload() ) {
	return;
}

// Load the plugin.
if ( class_exists( '\OneUpdate\Main' ) ) {
	\OneUpdate\Main::instance();
}
