<?php
/**
 * Registers the plugin's search settings.
 *
 * @package OneUpdate\Modules\Search
 */

declare(strict_types = 1);

namespace OneUpdate\Modules\Plugin;

use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Encryptor;

/**
 * Class - Settings
 */
final class Settings implements Registrable {
	/**
	 * The setting prefix.
	 */
	private const SETTING_PREFIX = 'oneupdate_';

	/**
	 * The setting group.
	 */
	public const SETTING_GROUP = self::SETTING_PREFIX . 'settings';

	// Governing Site Settings.
	public const OPTION_S3_CREDENTIALS = self::SETTING_PREFIX . 's3_credentials';
	public const OPTION_GITHUB_TOKEN   = self::SETTING_PREFIX . 'github_token';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		add_action( 'admin_init', [ $this, 'register_settings' ] );
		add_action( 'rest_api_init', [ $this, 'register_settings' ] );

		// Listen to updates.
	}

	/**
	 * Register plugin settings.
	 */
	public function register_settings(): void {

		$governing_settings = [
			self::OPTION_S3_CREDENTIALS => [
				'type'              => 'object',
				'label'             => __( 'S3 Credentials', 'oneupdate' ),
				'description'       => __( 'Credentials used to connect to the S3 service.', 'oneupdate' ),
				'sanitize_callback' => static function ( $value ): array|null {
					if ( ! is_array( $value ) ) {
						return null;
					}
					return [
						'accessKey'  => isset( $value['accessKey'] ) ? sanitize_text_field( $value['accessKey'] ) : '',
						'secretKey'  => isset( $value['secretKey'] ) ? sanitize_text_field( $value['secretKey'] ) : '',
						'bucketName' => isset( $value['bucketName'] ) ? sanitize_text_field( $value['bucketName'] ) : '',
						'region'     => isset( $value['region'] ) ? sanitize_text_field( $value['region'] ) : '',
						'endpoint'   => isset( $value['endpoint'] ) ? esc_url_raw( $value['endpoint'] ) : '',
					];
				},
				'show_in_rest'      => [
					'schema' => [
						'type'       => 'object',
						'properties' => [
							'accessKey'  => [
								'type' => 'string',
							],
							'secretKey'  => [
								'type' => 'string',
							],
							'bucketName' => [
								'type' => 'string',
							],
							'region'     => [
								'type' => 'string',
							],
							'endpoint'   => [
								'type'   => 'string',
								'format' => 'uri',
							],
						],
					],
				],
			],
			self::OPTION_GITHUB_TOKEN   => [
				'type'              => 'string',
				'label'             => __( 'GitHub Token', 'oneupdate' ),
				'description'       => __( 'Personal Access Token used to connect to GitHub.', 'oneupdate' ),
				'sanitize_callback' => static function ( $value ): string {
					return sanitize_text_field( $value );
				},
				'show_in_rest'      => true,
			],
		];

		foreach ( $governing_settings as $key => $args ) {
			register_setting(
				self::SETTING_GROUP,
				$key,
				$args
			);
		}
	}

	/**
	 * Get S3 credentials.
	 *
	 * @return array<string,string>
	 */
	public static function get_s3_credentials(): array {
		$credentials = get_option( self::OPTION_S3_CREDENTIALS, [] );
		if ( empty( $credentials ) || ! is_array( $credentials ) ) {
			return [];
		}
		return [
			'accessKey'  => isset( $credentials['accessKey'] ) ? Encryptor::decrypt( $credentials['accessKey'] ) : '',
			'secretKey'  => isset( $credentials['secretKey'] ) ? Encryptor::decrypt( $credentials['secretKey'] ) : '',
			'bucketName' => isset( $credentials['bucketName'] ) ? $credentials['bucketName'] : '',
			'region'     => isset( $credentials['region'] ) ? $credentials['region'] : '',
			'endpoint'   => isset( $credentials['endpoint'] ) ? $credentials['endpoint'] : '',
		];
	}

	/**
	 * Set S3 credentials.
	 *
	 * @param array<string,string> $credentials Credentials.
	 * @return bool
	 */
	public static function set_s3_credentials( array $credentials ): bool {
		$sanitized_credentials = [
			'accessKey'  => isset( $credentials['accessKey'] ) ? Encryptor::encrypt( sanitize_text_field( $credentials['accessKey'] ) ) : '',
			'secretKey'  => isset( $credentials['secretKey'] ) ? Encryptor::encrypt( sanitize_text_field( $credentials['secretKey'] ) ) : '',
			'bucketName' => isset( $credentials['bucketName'] ) ? sanitize_text_field( $credentials['bucketName'] ) : '',
			'region'     => isset( $credentials['region'] ) ? sanitize_text_field( $credentials['region'] ) : '',
			'endpoint'   => isset( $credentials['endpoint'] ) ? esc_url_raw( $credentials['endpoint'] ) : '',
		];
		return update_option( self::OPTION_S3_CREDENTIALS, $sanitized_credentials );
	}

	/**
	 * Get GitHub token.
	 *
	 * @return string
	 */
	public static function get_github_token(): string {
		$token = get_option( self::OPTION_GITHUB_TOKEN, '' );
		if ( empty( $token ) ) {
			return '';
		}
		return Encryptor::decrypt( $token );
	}

	/**
	 * Set GitHub token.
	 *
	 * @param string $token Token.
	 * @return bool
	 */
	public static function set_github_token( string $token ): bool {
		$sanitized_token = Encryptor::encrypt( sanitize_text_field( $token ) );

		if ( false === $sanitized_token ) {
			return false;
		}

		return update_option( self::OPTION_GITHUB_TOKEN, $sanitized_token );
	}
}
