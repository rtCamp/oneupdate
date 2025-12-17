<?php
/**
 * Base REST controller class.
 *
 * Includes the shared namespace, version and hook registration.
 *
 * @package OneUpdate\Modules\Rest
 */

declare( strict_types = 1 );

namespace OneUpdate\Modules\Rest;

use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Modules\Settings\Settings;


/**
 * Class - Abstract_REST_Controller
 */
abstract class Abstract_REST_Controller extends \WP_REST_Controller implements Registrable {
	/**
	 * The namespace for the REST API.
	 */
	public const NAMESPACE = 'oneupdate/v1';

	/**
	 * {@inheritDoc}
	 *
	 * Reuses the namespace constant.
	 *
	 * @var string
	 */
	protected $namespace = self::NAMESPACE;

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * {@inheritDoc}
	 *
	 * We throw an exception here to force the child class to implement this method.
	 *
	 * @throws \Exception If method not implemented.
	 *
	 * @codeCoverageIgnore
	 */
	public function register_routes(): void {
		throw new \Exception( __FUNCTION__ . ' Method not implemented.' );
	}

	/**
	 * Permission callback to check if the user has manage_options capability.
	 *
	 * @return bool
	 */
	public static function permission_callback(): bool {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Checks for the use of the OneUpdate API key in the request headers.
	 *
	 * @todo this should be on a hook.
	 *
	 * @param \WP_REST_Request<array{}> $request Request.
	 * @return bool
	 */
	public function check_api_permissions( $request ): bool {
		// check if the request is from same site.
		if ( Settings::is_governing_site() ) {
			return current_user_can( 'manage_options' );
		}

		// See if the `X_ONEUPDATE_TOKEN` header is present.
		$token = $request->get_header( 'X_ONEUPDATE_TOKEN' );
		$token = ! empty( $token ) ? sanitize_text_field( wp_unslash( $token ) ) : '';

		// Bail if the token is missing or invalid.
		if ( ! hash_equals( Settings::get_api_key(), $token ) ) {
			return false;
		}

		$request_origin = $request->get_header( 'origin' );
		$request_origin = ! empty( $request_origin ) ? esc_url_raw( wp_unslash( $request_origin ) ) : '';
		$user_agent     = $request->get_header( 'user-agent' );
		$user_agent     = ! empty( $user_agent ) ? sanitize_text_field( wp_unslash( $user_agent ) ) : '';

		/**
		 * If both origin and user-agent are missing, deny access.
		 *
		 * Here checking both because server side requests will not have origin header.
		 */
		if ( empty( $request_origin ) && empty( $user_agent ) ) {
			return false;
		}

		// If it's the same domain, we're good.
		if ( self::is_same_domain( get_site_url(), $request_origin ) ) {
			return true;
		}

		$governing_site_url = Settings::get_parent_site_url();

		// If it's a healthcheck with no governing site, allow it and set the governing site.
		if ( empty( $governing_site_url ) ) {
			if ( '/' . $this->namespace . '/health-check' === $request->get_route() ) {
				Settings::set_parent_site_url( $request_origin );
				return true;
			}
			return false;
		}

		// if token is valid and request is from different domain then check if it matches governing site url.
		return self::is_same_domain( $governing_site_url, $request_origin ) || false !== strpos( $user_agent, $governing_site_url );
	}

	/**
	 * Build API endpoint URL.
	 *
	 * @param string $site_url       The base URL of the site.
	 * @param string $endpoint       The specific endpoint path.
	 * @param string $rest_namespace The REST namespace. Default: oneupdate/v1).
	 *
	 * @return string Full API endpoint URL.
	 */
	protected function build_api_endpoint( string $site_url, string $endpoint, string $rest_namespace = self::NAMESPACE ): string {
		return esc_url_raw( trailingslashit( $site_url ) ) . '/wp-json/' . $rest_namespace . '/' . ltrim( $endpoint, '/' );
	}

	/**
	 * Check if two URLs belong to the same domain.
	 *
	 * @param string $url1 First URL.
	 * @param string $url2 Second URL.
	 *
	 * @return bool True if both URLs belong to the same domain, false otherwise.
	 */
	protected static function is_same_domain( string $url1, string $url2 ): bool {
		$parsed_url1 = wp_parse_url( $url1 );
		$parsed_url2 = wp_parse_url( $url2 );

		if ( ! isset( $parsed_url1['host'] ) || ! isset( $parsed_url2['host'] ) ) {
			return false;
		}
		return hash_equals( $parsed_url1['host'], $parsed_url2['host'] );
	}
}
