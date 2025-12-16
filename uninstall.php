<?php
/**
 * This will be executed when the plugin is uninstalled.
 *
 * @package OneUpdate
 */

declare( strict_types=1 );

namespace OneUpdate;

// If uninstall not called from WordPress, exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Multisite loop for uninstalling from all sites.
 */
function multisite_uninstall(): void {
	if ( ! is_multisite() ) {
		uninstall();
		return;
	}

	delete_network_plugin_data();

	$site_ids = get_sites(
		[
			'fields' => 'ids',
			'number' => 0,
		]
	) ?: [];

	foreach ( $site_ids as $site_id ) {
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.switch_to_blog_switch_to_blog
		if ( ! switch_to_blog( (int) $site_id ) ) {
			continue;
		}

		uninstall();
		restore_current_blog();
	}
}

/**
 * The (site-specific) uninstall function.
 */
function uninstall(): void {
	delete_plugin_data();
}

/**
 * Delete multisite network plugin data.
 */
function delete_network_plugin_data(): void {
	$options = [
		'oneupdate_multisite_governing_site',
	];

	foreach ( $options as $option ) {
		delete_site_option( $option );
	}
}

/**
 * Deletes meta, options, transients, etc.
 */
function delete_plugin_data(): void {

	// list of actions to be cleared on uninstall.
	$actions_to_clear = [
		'oneupdate_governing_site_configured',
		'oneupdate_add_deduplicated_users',
	];

	// Clear scheduled actions.
	if ( function_exists( 'as_unschedule_all_actions' ) ) {
		foreach ( $actions_to_clear as $action ) {
			as_unschedule_all_actions( $action );
		}
	}

	// Options to clean up.
	$options = [
		'oneupdate_child_site_api_key',
		'oneupdate_consumer_api_key',
		'oneupdate_db_version',
		'oneupdate_governing_site_url',
		'oneupdate_new_users',
		'oneupdate_parent_site_url',
		'oneupdate_profile_update_requests',
		'oneupdate_shared_sites',
		'oneupdate_site_type',
	];

	foreach ( $options as $option ) {
		delete_option( $option );
	}

	// Drop custom tables created by the OneUpdate.
	$tables_to_drop = [
		'oneupdate_deduplicated_users',
		'oneupdate_profile_requests',
	];

	global $wpdb;
	foreach ( $tables_to_drop as $table ) {
		$full_table_name = $wpdb->prefix . $table;
		$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $full_table_name ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- this is to drop table on uninstall
	}
}

// Run the uninstaller.
multisite_uninstall();