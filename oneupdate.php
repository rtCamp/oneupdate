<?php
/**
 * Plugin Name: OneUpdate
 * Description: OneUpdate - Enterprise WordPress Plugin Manager Automate plugin updates across multiple WordPress sites with CI/CD integration. Creates pull requests for seamless development-to-production workflows.
 * Author: Utsav Patel, rtCamp
 * Author URI: https://rtcamp.com
 * Plugin URI: https://github.com/rtCamp/OneUpdate/
 * Update URI: https://github.com/rtCamp/OneUpdate/
 * License: GPL2+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: oneupdate
 * Domain Path: /languages
 * Version: 1.0.0
 * Requires PHP: 8.0
 * Requires at least: 6.8
 * Tested up to: 6.8.2
 *
 * @package OneUpdate
 */

namespace OneUpdate;

// Exit if accessed directly.
defined( 'ABSPATH' ) || exit();

/**
 * Define the plugin constants.
 */
function constants(): void {
	/**
	 * Version of the plugin.
	 */
	define( 'ONEUPDATE_VERSION', '1.0.0' );

	/**
	 * Root path to the plugin directory.
	 */
	define( 'ONEUPDATE_DIR', plugin_dir_path( __FILE__ ) );

	/**
	 * Root URL to the plugin directory.
	 */
	define( 'ONEUPDATE_URL', plugin_dir_url( __FILE__ ) );

	/**
	 * Plugin basename.
	 */
	define( 'ONEUPDATE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
}

constants();

// If autoloader failed, we cannot proceed.
require_once __DIR__ . '/inc/Autoloader.php';
if ( ! \OneUpdate\Autoloader::autoload() ) {
	return;
}

/**
 * Load plugin.
 */
if ( class_exists( 'OneUpdate\Main' ) ) {
	add_action(
		'plugins_loaded',
		'\OneUpdate\load_plugin'
	);
}

/**
 * Load OneUpdate plugin functionality.
 *
 * @return void
 */
function load_plugin(): void {
	\OneUpdate\Main::instance();

	//phpcs:ignore PluginCheck.CodeAnalysis.DiscouragedFunctions.load_plugin_textdomainFound -- @todo remove before submitting to .org.
	load_plugin_textdomain( 'oneupdate', false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
}

// @todo need to remove below code.

use OneUpdate\Plugin_Configs\DB;

/**
 * Create custom database table on plugin activation and schedule cron jobs.
 */
register_activation_hook(
	__FILE__,
	function () {

		// create database tables.
		DB::create_oneupdate_s3_zip_history_table();

		// Schedule cron jobs - clear any existing schedules first.
		wp_clear_scheduled_hook( 'oneupdate_s3_zip_cleanup_event' );

		// Schedule cron jobs.
		if ( ! wp_next_scheduled( 'oneupdate_s3_zip_cleanup_event' ) ) {
			wp_schedule_event( time(), 'hourly', 'oneupdate_s3_zip_cleanup_event' );
		}
	}
);

/**
 * Deactivate the plugin and clean up options.
 */
register_deactivation_hook(
	__FILE__,
	function () {
		wp_clear_scheduled_hook( 'oneupdate_s3_zip_cleanup_event' );

		// remove oneupdate_s3_zip_history_cleanup_event event even though its removed but to make sure its completely removed from cron jobs.
		wp_clear_scheduled_hook( 'oneupdate_s3_zip_history_cleanup_event' );
	}
);