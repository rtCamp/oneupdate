<?php
/**
 * Registers the plugin's settings and options
 *
 * @package OneUpdate\Modules\Settings
 */

declare(strict_types = 1);

namespace OneUpdate\Modules\Settings;

use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Encryptor;

/**
 * Class - Settings
 */
final class Settings implements Registrable {
	/**
	 * The setting prefix.
	 *
	 * @todo need to replace globally with single source of truth.
	 *
	 * @var string
	 */
	private const SETTING_PREFIX = 'oneupdate_';

	/**
	 * The setting group.
	 */
	public const SETTING_GROUP = self::SETTING_PREFIX . 'settings';

	/**
	 * Setting keys
	 */
	// Shared settings.
	public const OPTION_SITE_TYPE = self::SETTING_PREFIX . 'site_type';

	// Consumer settings.
	public const OPTION_CONSUMER_API_KEY         = self::SETTING_PREFIX . 'consumer_api_key';
	public const OPTION_CONSUMER_PARENT_SITE_URL = self::SETTING_PREFIX . 'parent_site_url';

	// Governing settings.
	public const OPTION_GOVERNING_SHARED_SITES = self::SETTING_PREFIX . 'shared_sites';

	/**
	 * Site type keys.
	 */
	public const SITE_TYPE_CONSUMER  = 'brand-site';
	public const SITE_TYPE_GOVERNING = 'governing-site';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		add_action( 'admin_init', [ $this, 'register_settings' ] );
		add_action( 'rest_api_init', [ $this, 'register_settings' ] );

		// Listen to updates.
		add_action( 'update_option_' . self::OPTION_SITE_TYPE, [ $this, 'on_site_type_change' ], 10, 2 );
	}

	/**
	 * Register plugin settings.
	 */
	public function register_settings(): void {
		$shared_settings = [
			self::OPTION_SITE_TYPE => [
				'type'              => 'string',
				'label'             => __( 'Site Type', 'oneupdate' ),
				'description'       => __( 'Defines whether this site is a governing or a brand site.', 'oneupdate' ),
				'sanitize_callback' => static function ( $value ): string {
					$valid_values = [
						self::SITE_TYPE_CONSUMER  => true,
						self::SITE_TYPE_GOVERNING => true,
					];

					return is_string( $value ) && isset( $valid_values[ $value ] ) ? $value : '';
				},
				'show_in_rest'      => [
					'schema' => [
						'enum' => [ self::SITE_TYPE_CONSUMER, self::SITE_TYPE_GOVERNING ],
					],
				],
			],
		];

		$consumer_settings = [
			self::OPTION_CONSUMER_API_KEY         => [
				'type'              => 'string',
				'label'             => __( 'Consumer API Key', 'oneupdate' ),
				'description'       => __( 'API key used by governing site to authenticate requests from this consumer site.', 'oneupdate' ),
				'sanitize_callback' => 'sanitize_text_field',
				'show_in_rest'      => [
					'schema' => [
						'type' => 'string',
					],
				],
			],
			self::OPTION_CONSUMER_PARENT_SITE_URL => [
				'type'              => 'string',
				'label'             => __( 'Parent Site URL', 'oneupdate' ),
				'description'       => __( 'The URL of the governing site that manages this consumer site.', 'oneupdate' ),
				'sanitize_callback' => static function ( $value ): string|null {
					return is_string( $value ) ? untrailingslashit( esc_url_raw( $value ) ) : null;
				},
				'show_in_rest'      => [
					'schema' => [
						'type'   => 'string',
						'format' => 'uri',
					],
				],
			],
		];

		$governing_settings = [
			self::OPTION_GOVERNING_SHARED_SITES => [
				'type'              => 'array',
				'label'             => __( 'Brand Sites', 'oneupdate' ),
				'description'       => __( 'An array of brand sites connected to this governing site.', 'oneupdate' ),
				'sanitize_callback' => [ self::class, 'sanitize_shared_sites' ],
				'show_in_rest'      => [
					'schema' => [
						'type'  => 'array',
						'items' => [
							'type'       => 'object',
							'properties' => [
								'id'      => [
									'type' => 'string',
								],
								'name'    => [
									'type' => 'string',
								],
								'url'     => [
									'type'   => 'string',
									'format' => 'uri',
								],
								'api_key' => [
									'type' => 'string',
								],
								'gh_repo' => [
									'type' => 'string',
								],
							],
						],
					],
				],
			],
		];

		$all_settings = array_merge(
			$shared_settings,
			self::is_consumer_site() ? $consumer_settings : $governing_settings
		);

		foreach ( $all_settings as $key => $args ) {
			register_setting(
				self::SETTING_GROUP,
				$key,
				$args
			);
		}
	}

	/**
	 * Ensures the API key is generated when the site type changes to 'consumer'.
	 *
	 * @param mixed $old_value The old value.
	 * @param mixed $new_value The new value.
	 */
	public function on_site_type_change( $old_value, $new_value ): void { // phpcs:ignore SlevomatCodingStandard.Functions.UnusedParameter.UnusedParameter
		if ( self::SITE_TYPE_CONSUMER !== $new_value ) {
			return;
		}

		// By getting the API key, it will be generated if it doesn't exist.
		self::get_api_key();
	}

	/**
	 * Sanitize the `shared_sites` option.
	 *
	 * @param mixed $input The input value.
	 *
	 * @return array{
	 * id: string,
	 * name: string,
	 * url: string,
	 * api_key: string,
	 * gh_repo: string
	 * }[]
	 */
	public static function sanitize_shared_sites( $input ): array {
		if ( ! is_array( $input ) || empty( $input ) ) {
			return [];
		}

		$sanitized = [];

		foreach ( $input as $site_data ) {
			if ( ! is_array( $site_data ) ) {
				continue;
			}

			$site_id      = isset( $site_data['id'] ) ? sanitize_text_field( $site_data['id'] ) : '';
			$site_name    = isset( $site_data['name'] ) ? sanitize_text_field( $site_data['name'] ) : '';
			$site_url     = isset( $site_data['url'] ) ? esc_url_raw( $site_data['url'] ) : '';
			$site_api_key = isset( $site_data['api_key'] ) ? sanitize_text_field( $site_data['api_key'] ) : '';
			$gh_repo      = isset( $site_data['gh_repo'] ) ? sanitize_text_field( $site_data['gh_repo'] ) : '';

			// Only save if required fields are filled.
			if ( empty( $site_name ) || empty( $site_url ) ) {
				continue;
			}

			$sanitized[] = [
				'id'      => $site_id ?: wp_generate_uuid4(),
				'name'    => $site_name,
				'url'     => untrailingslashit( $site_url ),
				'api_key' => $site_api_key,
				'gh_repo' => $gh_repo,
			];
		}

		return $sanitized;
	}

	/**
	 * Get brand sites configured for this governing site.
	 *
	 * @return array<string,array{
	 *  api_key: string,
	 *  id: string,
	 *  name: string,
	 *  url: string,
	 *  gh_repo: string
	 * }>
	 */
	public static function get_shared_sites(): array {
		$brands = get_option( self::OPTION_GOVERNING_SHARED_SITES, [] );

		if ( ! is_array( $brands ) ) {
			return [];
		}

		$brands_to_return = [];
		foreach ( $brands as $brand ) {
			if ( ! is_array( $brand ) || empty( $brand['url'] ) ) {
				continue;
			}

			// Decrypt API key, ensuring we always return a string.
			$decrypted_api_key = '';
			if ( ! empty( $brand['api_key'] ) ) {
				$decrypted         = Encryptor::decrypt( $brand['api_key'] );
				$decrypted_api_key = is_string( $decrypted ) ? $decrypted : '';
			}

			// Always use a trailing-slash URL.
			$url = trailingslashit( $brand['url'] );

			$brands_to_return[ $url ] = [
				'api_key' => $decrypted_api_key,
				'id'      => isset( $brand['id'] ) ? (string) $brand['id'] : '',
				'name'    => isset( $brand['name'] ) ? (string) $brand['name'] : '',
				'url'     => $url,
				'gh_repo' => isset( $brand['gh_repo'] ) ? (string) $brand['gh_repo'] : '',
			];
		}

		return $brands_to_return;
	}

	/**
	 * Set the shared sites.
	 *
	 * @param array<string,array<string,mixed>> $sites The sites to set.
	 *
	 * @phpstan-param array<string,array{
	 *   api_key: string,
	 *   id: string,
	 *   name: string,
	 *   url: string,
	 *   gh_repo: string
	 * }> $sites The sites to set.
	 *
	 * @return bool True on success, false on failure.
	 */
	public static function set_shared_sites( array $sites ): bool {
		foreach ( $sites as &$site ) {
			if ( empty( $site['api_key'] ) || empty( $site['url'] ) ) {
				continue;
			}
			// Ensure URLs are trailing-slashed.
			$site['url'] = trailingslashit( $site['url'] );

			// Encrypt API keys before saving.
			$encrypted_key = Encryptor::encrypt( $site['api_key'] );

			// Bail if encryption fails.
			if ( false === $encrypted_key ) {
				return false;
			}

			$site['api_key'] = $encrypted_key;
		}

		return update_option( self::OPTION_GOVERNING_SHARED_SITES, array_values( $sites ), false );
	}

	/**
	 * Get the current site type.
	 */
	public static function get_site_type(): ?string {
		$value = get_option( self::OPTION_SITE_TYPE, null );

		return is_string( $value ) ? $value : null;
	}

	/**
	 * Check if the current site is a governing site.
	 */
	public static function is_governing_site(): bool {
		return self::SITE_TYPE_GOVERNING === self::get_site_type();
	}

	/**
	 * Check if the current site is a consumer site.
	 */
	public static function is_consumer_site(): bool {
		return self::SITE_TYPE_CONSUMER === self::get_site_type();
	}

	/**
	 * Gets the API key, generating a new one if it doesn't exist.
	 */
	public static function get_api_key(): string {
		$api_key = get_option( self::OPTION_CONSUMER_API_KEY, '' );

		if ( empty( $api_key ) ) {
			return self::regenerate_api_key();
		}

		$decrypted = Encryptor::decrypt( $api_key );

		// If decryption fails, regenerate the API key.
		if ( false === $decrypted ) {
			return self::regenerate_api_key();
		}

		return $decrypted;
	}

	/**
	 * Regenerates the API key.
	 *
	 * @throws \RuntimeException If encryption or database update fails.
	 *
	 * @return string The new API key.
	 */
	public static function regenerate_api_key(): string {
		$api_key   = self::generate_api_key();
		$encrypted = Encryptor::encrypt( $api_key );

		if ( false === $encrypted ) {
			throw new \RuntimeException( 'Failed to encrypt API key.' );
		}

		$updated = update_option( self::OPTION_CONSUMER_API_KEY, $encrypted );

		if ( false === $updated ) {
			throw new \RuntimeException( 'Failed to save encrypted API key to database.' );
		}

		return $api_key;
	}

	/**
	 * Get the parent URL for consumer sites.
	 */
	public static function get_parent_site_url(): ?string {
		$value = get_option( self::OPTION_CONSUMER_PARENT_SITE_URL, null );
		return is_string( $value ) ? $value : null;
	}

	/**
	 * Set the parent URL for consumer sites.
	 *
	 * @param string $url The parent site URL.
	 */
	public static function set_parent_site_url( string $url ): bool {
		return update_option( self::OPTION_CONSUMER_PARENT_SITE_URL, untrailingslashit( esc_url_raw( $url ) ), false );
	}

	/**
	 * Generate a random API key.
	 */
	private static function generate_api_key(): string {
		return wp_generate_password( 128, false, false );
	}
}
