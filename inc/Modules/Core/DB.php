<?php
/**
 * DB module.
 *
 * @package OneUpdate\Modules\Core
 */

declare( strict_types = 1 );

namespace OneUpdate\Modules\Core;

use OneUpdate\Contracts\Interfaces\Registrable;

/**
 * Class DB
 */
class DB implements Registrable {
	/**
	 * Global prefix.
	 *
	 * @todo need to replace with constant from main plugin file.
	 *
	 * @var string
	 */
	private const ONEUPDATE = 'oneupdate_';

	/**
	 * DB version.
	 *
	 * @var string
	 */
	private const DB_VERSION = self::ONEUPDATE . 'db_version';

	/**
	 * S3 Zip History Table.
	 *
	 * @var string
	 */
	public const S3_ZIP_HISTORY_TABLE = self::ONEUPDATE . 's3_zip_history';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		// This will be triggered on plugins_loaded action.
		self::maybe_create_tables();
	}

	/**
	 * Maybe create database tables.
	 */
	private static function maybe_create_tables(): void {

		$current_version = ONEUPDATE_VERSION;
		$db_version      = get_option( self::DB_VERSION, '0.0.0' );

		if ( ! version_compare( $db_version, $current_version, '<' ) ) {
			return;
		}

		self::create_s3_zip_history_table();

		update_option( self::DB_VERSION, $current_version, false );
	}

	/**
	 * Create S3 Zip History Table.
	 */
	private static function create_s3_zip_history_table(): void {
		global $wpdb;
		$table_name      = $wpdb->prefix . self::S3_ZIP_HISTORY_TABLE;
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS $table_name (
		id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
		file_name VARCHAR(255) NOT NULL,
		s3_key VARCHAR(255) NOT NULL,
		presigned_url TEXT NOT NULL,
		upload_time DATETIME NOT NULL,
		action VARCHAR(50) NOT NULL,
		PRIMARY KEY (id)
	) $charset_collate;";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
