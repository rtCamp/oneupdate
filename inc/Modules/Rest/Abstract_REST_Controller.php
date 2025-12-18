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
	 * GitHub API headers.
	 *
	 * @var array<string, string>
	 */
	protected const GITHUB_API_HEADERS = [
		'Accept'          => 'application/vnd.github.v3+json',
		'User-Agent'      => 'OneUpdate Plugin Loader',
		'Content-Type'    => 'application/json',
		'Accept-Encoding' => 'identity',
	];

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
	 * Checks for the use of the OneDesign API key in the request headers.
	 *
	 * @todo this should be on a hook.
	 *
	 * @param \WP_REST_Request<array{}> $request Request.
	 */
	public function check_api_permissions( $request ): bool {
		// If it's the same domain, check if the current user can manage options.
		$request_origin = $request->get_header( 'origin' );
		$request_origin = ! empty( $request_origin ) ? esc_url_raw( wp_unslash( $request_origin ) ) : '';
		$parsed_origin  = wp_parse_url( $request_origin );
		$request_url    = ! empty( $parsed_origin['scheme'] ) && ! empty( $parsed_origin['host'] ) ? sprintf(
			'%s://%s',
			$parsed_origin['scheme'],
			$parsed_origin['host']
		) : '';

		if ( empty( $request_url ) || $this->is_url_from_host( get_site_url(), $parsed_origin['host'] ) ) {
			return current_user_can( 'manage_options' );
		}

		// See if the `X-OneUpdate-Token` header is present.
		$token = $request->get_header( 'X-OneUpdate-Token' );
		$token = ! empty( $token ) ? sanitize_text_field( wp_unslash( $token ) ) : '';
		if ( empty( $token ) ) {
			return false;
		}

		$stored_key = $this->get_stored_api_key( trailingslashit( $request_url ) );
		if ( empty( $stored_key ) || ! hash_equals( $stored_key, $token ) ) {
			return false;
		}

		// Governing sites were checked by ::get_stored_api_key already.
		if ( Settings::is_governing_site() ) {
			return true;
		}

		// If it's not a healthcheck, compare the origins.
		$governing_site_url = Settings::get_parent_site_url();
		if ( '/' . $this->namespace . '/health-check' !== $request->get_route() ) {
			return ! empty( $governing_site_url ) ? $this->is_url_from_host( $governing_site_url, $parsed_origin['host'] ) : false;
		}

		// For health-checks, if no governing site is set, we set it now.
		Settings::set_parent_site_url( $request_origin );
		return true;
	}

	/**
	 * Check if two URLs belong to the same host.
	 *
	 * @param string $url  The URL to check.
	 * @param string $host The host to compare against.
	 *
	 * @return bool True if both URLs belong to the same domain, false otherwise.
	 */
	private function is_url_from_host( string $url, string $host ): bool {
		$parsed_url = wp_parse_url( $url );

		return isset( $parsed_url['host'] ) && $parsed_url['host'] === $host;
	}

	/**
	 * Gets the locally-stored API key for comparison.
	 *
	 * @param ?string $site_url Site URL. Only used for child->governing site requests.
	 *
	 * @return string The stored API key. Empty string if not found.
	 */
	private function get_stored_api_key( ?string $site_url = null ): string {
		if ( Settings::is_consumer_site() ) {
			return Settings::get_api_key();
		}

		// If there's no child site URL we cannot match the API key.
		if ( ! isset( $site_url ) ) {
			return '';
		}

		$shared_sites = Settings::get_shared_sites();

		return ! empty( $shared_sites[ $site_url ]['api_key'] ) ? $shared_sites[ $site_url ]['api_key'] : '';
	}

	/**
	 * Get GitHub API headers with authorization.
	 *
	 * @param string $github_token GitHub personal access token.
	 * @return array
	 */
	protected static function get_github_headers( string $github_token ): array {
		return array_merge(
			self::GITHUB_API_HEADERS,
			[ 'Authorization' => 'Bearer ' . $github_token ]
		);
	}
}
