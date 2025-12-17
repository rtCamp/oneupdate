<?php
/**
 * Class S3 -  handles S3 related functionalities.
 *
 * @package OneUpdate
 */

declare(strict_types = 1);

namespace OneUpdate\Modules\Plugin;

use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Modules\Settings\Settings;
use OneUpdate\Modules\Core\DB;
use OneUpdate\Modules\Plugin\Settings as Plugin_Settings;
use Aws\S3\S3Client;
use Aws\Exception\AwsException;

/**
 * Class - S3
 */
final class S3 implements Registrable {
	/**
	 * Prefix for options.
	 *
	 * @todo replace with a cross-plugin.
	 */
	private const PREFIX = 'oneupdate_';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {

        if( ! Settings::is_governing_site() ) {
            return;
        }

    add_action( 'oneupdate_s3_zip_cleanup_event', array( $this, 'zip_cleanup' ) );
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

		$one_hour_ago  = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp', 1 ) - 3600 );
		$expired_files = $wpdb->get_results(
			$wpdb->prepare( "SELECT s3_key FROM $table_name WHERE upload_time <= %s", $one_hour_ago )
		);

		foreach ( $expired_files as $file ) {
			try {
				$s3->deleteObject(
					array(
						'Bucket' => $s3_credentials['bucketName'] ?? '',
						'Key'    => $file->s3_key,
					)
				);
			} catch ( AwsException $e ) {
				throw new \Exception(
					\sprintf( 
						/* translators: %s is the error message from AWS S3 */
						__( 'Error deleting file from S3: %s', 'oneupdate' ), 
						$e->getMessage()
					),
					500,
					$e
				);
			}
		}
		// delete expired records from the database.
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM $table_name WHERE upload_time <= %s",
				$one_hour_ago
			)
		);
	}

    /**
	 * Get S3 instance.
	 *
	 * @return S3Client
	 */
	public static function get_s3_instance(): S3Client {
		$s3_credentials = Plugin_Settings::get_s3_credentials();
		if ( empty( $s3_credentials ) || ! is_array( $s3_credentials ) ) {
			return new S3Client( array() ); // Return an empty S3Client.
		}
		$s3 = new S3Client(
			array(
				'version'                 => 'latest',
				'region'                  => $s3_credentials['region'] ?? '',
				'credentials'             => array(
					'key'    => $s3_credentials['accessKey'] ?? '',
					'secret' => $s3_credentials['secretKey'] ?? '',
				),
				'use_accelerate_endpoint' => true,
			)
		);

		// first check if the bucket has getBucketAccelerateConfiguration.

		try {
			$accelerate_config = $s3->getBucketAccelerateConfiguration(
				array(
					'Bucket' => $s3_credentials['bucketName'] ?? '',
				)
			);
			if ( ! empty( $accelerate_config['Status'] ) && 'Enabled' === $accelerate_config['Status'] ) {
				return $s3;
			}
		} catch ( AwsException $e ) {
			$s3 = new S3Client(
				array(
					'version'                 => 'latest',
					'region'                  => $s3_credentials['region'] ?? '',
					'endpoint'                => $s3_credentials['endpoint'] ?? '',
					'credentials'             => array(
						'key'    => $s3_credentials['accessKey'] ?? '',
						'secret' => $s3_credentials['secretKey'] ?? '',
					),
					'use_path_style_endpoint' => true, // use path style endpoint.
				)
			);
		}

		return $s3;
	}
}