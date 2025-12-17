<?php
/**
 * Class S3 -  handles S3 related functionalities.
 *
 * @package OneUpdate
 */

declare(strict_types = 1);

namespace OneUpdate\Modules\Plugin;

use Aws\S3\S3Client;
use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Modules\Core\DB;
use OneUpdate\Modules\Jobs\Schedular;
use OneUpdate\Modules\Plugin\Settings as Plugin_Settings;
use OneUpdate\Modules\Settings\Settings;

/**
 * Class - S3
 */
final class S3 implements Registrable {

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {

		if ( ! Settings::is_governing_site() ) {
			return;
		}

		add_action( Schedular::S3_ZIP_CLEANUP, [ $this, 'zip_cleanup' ] );
	}

	/**
	 * Handle S3 zip cleanup event.
	 *
	 * @return void
	 *
	 * @throws \Exception If there is an error deleting files from S3.
	 */
	public function zip_cleanup(): void {
		$s3_credentials = Plugin_Settings::get_s3_credentials();

		global $wpdb;
		$table_name = $wpdb->prefix . DB::S3_ZIP_HISTORY_TABLE;
		$s3         = self::get_s3_instance();

		$one_hour_ago  = gmdate( 'Y-m-d H:i:s', time() - 3600 );
		$expired_files = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- it's intended.
			$wpdb->prepare( "SELECT s3_key FROM $table_name WHERE upload_time <= %s", $one_hour_ago ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- it's intended.
		);

		foreach ( $expired_files as $file ) {
			try {
				$s3->deleteObject(
					[
						'Bucket' => $s3_credentials['bucketName'] ?? '',
						'Key'    => $file->s3_key,
					]
				);
			} catch ( \Aws\Exception\AwsException $e ) {
				throw new \Exception(
					\sprintf(
						/* translators: %s is the error message from AWS S3 */
						esc_html__( 'Error deleting file from S3: %s', 'oneupdate' ),
						$e->getMessage() // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- exception message.
					),
					500,
					$e // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- exception message.
				);
			}
		}
		// delete expired records from the database.
		$wpdb->query( // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- it's intended.
			$wpdb->prepare(
				"DELETE FROM $table_name WHERE upload_time <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- it's intended.
				$one_hour_ago
			)
		);
	}

	/**
	 * Get S3 instance.
	 *
	 * @return \Aws\S3\S3Client
	 */
	public static function get_s3_instance(): S3Client {
		$s3_credentials = Plugin_Settings::get_s3_credentials();
		if ( empty( $s3_credentials ) || ! is_array( $s3_credentials ) ) {
			return new S3Client( [] ); // Return an empty S3Client.
		}
		$s3 = new S3Client(
			[
				'version'                 => 'latest',
				'region'                  => $s3_credentials['region'] ?? '',
				'credentials'             => [
					'key'    => $s3_credentials['accessKey'] ?? '',
					'secret' => $s3_credentials['secretKey'] ?? '',
				],
				'use_accelerate_endpoint' => true,
			]
		);

		// first check if the bucket has getBucketAccelerateConfiguration.

		try {
			$accelerate_config = $s3->getBucketAccelerateConfiguration(
				[
					'Bucket' => $s3_credentials['bucketName'] ?? '',
				]
			);
			if ( ! empty( $accelerate_config['Status'] ) && 'Enabled' === $accelerate_config['Status'] ) {
				return $s3;
			}
		} catch ( \Aws\Exception\AwsException $e ) {
			$s3 = new S3Client(
				[
					'version'                 => 'latest',
					'region'                  => $s3_credentials['region'] ?? '',
					'endpoint'                => $s3_credentials['endpoint'] ?? '',
					'credentials'             => [
						'key'    => $s3_credentials['accessKey'] ?? '',
						'secret' => $s3_credentials['secretKey'] ?? '',
					],
					'use_path_style_endpoint' => true, // use path style endpoint.
				]
			);
		}

		return $s3;
	}
}
