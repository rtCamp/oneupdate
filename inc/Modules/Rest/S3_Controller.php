<?php

declare(strict_types = 1);

/**
 * Class S3_Controller - this class has api endpoints for S3 uploads.
 *
 * @package OneUpdate
 */

namespace OneUpdate\Modules\Rest;

use OneUpdate\Modules\Core\DB;
use OneUpdate\Modules\Plugin\S3;
use OneUpdate\Modules\Plugin\Settings as Plugin_Settings;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Class S3_Controller
 */
class S3_Controller extends Abstract_REST_Controller {
	/**
	 * {@inheritDoc}
	 */
	public function register_routes(): void {
		/**
		 * Register REST route for s3 upload.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/upload',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle_s3_upload' ],
				'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
			]
		);

		/**
		 * Register REST route for s3 upload history.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/history',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_s3_upload_history' ],
				'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
			]
		);

		/**
		 * Register Route to perform S3 bucket health check.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/s3-health-check',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 's3_health_check' ],
				'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
			]
		);
	}

	/**
	 * Perform S3 bucket health check.
	 *
	 * @return \WP_REST_Response| \WP_Error
	 */
	public function s3_health_check(): WP_REST_Response|\WP_Error {
		$s3_credentials = Plugin_Settings::get_s3_credentials();
		if ( empty( $s3_credentials ) ) {
			return new WP_REST_Response( [ 'message' => 'S3 credentials not set' ], 400 );
		}
		$s3 = S3::get_s3_instance();
		try {
			// Attempt to list buckets to check connectivity.
			$result = $s3->listBuckets();
			if ( ! empty( $result['Buckets'] ) ) {
				return new WP_REST_Response(
					[
						'message' => 'S3 bucket is accessible',
						'buckets' => $result['Buckets'],
						'status'  => 'success',
					],
					200
				);
			}

			return new WP_REST_Response(
				[
					'message'        => 'No buckets found',
					'result'         => $result,
					's3'             => $s3,
					's3_credentials' => $s3_credentials,
				],
				404
			);
		} catch ( \Aws\Exception\AwsException $e ) {
			return new \WP_Error( 500, 'S3 health check failed: ' . $e->getMessage() );
		}
	}

	/**
	 * Handle S3 upload.
	 *
	 * @param \WP_REST_Request $request The REST request.
	 * @return \WP_REST_Response| \WP_Error
	 */
	public function handle_s3_upload( WP_REST_Request $request ): WP_REST_Response|\WP_Error {
		$files = $request->get_file_params();
		if ( empty( $files['file'] ) ) {
			return new WP_REST_Response( [ 'message' => 'No file uploaded' ], 400 );
		}

		$file = $files['file'];
		if ( pathinfo( $file['name'], PATHINFO_EXTENSION ) !== 'zip' ) {
			return new WP_REST_Response( [ 'message' => 'Only ZIP files are allowed' ], 400 );
		}
		$s3_credentials = Plugin_Settings::get_s3_credentials();
		$s3             = S3::get_s3_instance();

		$s3_key = 'Uploads/' . uniqid() . '_' . basename( $file['name'] );
		try {
			$result = $s3->putObject(
				[
					'Bucket'     => $s3_credentials['bucketName'] ?? '',
					'Key'        => $s3_key,
					'SourceFile' => $file['tmp_name'],
					'ACL'        => 'private',
				]
			);

			$presigned_url = $s3->createPresignedRequest(
				$s3->getCommand(
					'GetObject',
					[
						'Bucket' => $s3_credentials['bucketName'] ?? '',
						'Key'    => $s3_key,
					]
				),
				'+1 hour'
			)->getUri()->__toString();

			global $wpdb;
			$table_name    = $wpdb->prefix . DB::S3_ZIP_HISTORY_TABLE;
			$insert_result = $wpdb->insert( // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery -- inserting private plugin data.
				$table_name,
				[
					'file_name'     => $file['name'] ?? '',
					's3_key'        => $s3_key,
					'presigned_url' => $presigned_url,
					'upload_time'   => current_time( 'mysql' ),
					'action'        => 'Uploaded',
				]
			);

			if ( false === $insert_result ) {
				return new WP_REST_Response( [ 'message' => 'File uploaded to S3 but failed to save history: ' . $wpdb->last_error ], 500 );
			}

			return new WP_REST_Response(
				[
					'message'       => 'File uploaded successfully',
					'presigned_url' => $presigned_url,
					'result'        => $result,
				],
				200
			);
		} catch ( \Aws\Exception\AwsException $e ) {
			return new WP_REST_Response( [ 'message' => 'Upload failed: ' . $e->getMessage() ], 500 );
		}
	}

	/**
	 * Get S3 upload history.
	 *
	 * @return \WP_REST_Response| \WP_Error
	 */
	public function get_s3_upload_history(): WP_REST_Response|\WP_Error {
		global $wpdb;
		$table_name = $wpdb->prefix . DB::S3_ZIP_HISTORY_TABLE;
		$results    = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching -- Intentional direct query for history.
			$wpdb->prepare(
				'SELECT * FROM %i ORDER BY upload_time DESC',
				$table_name
			)
		);
		return new WP_REST_Response( $results ? $results : [], 200 );
	}
}
