<?php
/**
 * This is routes for Settings options.
 *
 * @package OneUpdate
 */

declare( strict_types = 1 );

namespace OneUpdate\Modules\Rest;

use OneUpdate\Modules\Settings\Settings;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Class Basic_Options_Controller
 */
class Basic_Options_Controller extends Abstract_REST_Controller {
	/**
	 * {@inheritDoc}
	 */
	public function register_routes(): void {

		/**
		 * Register a route for health-check.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/health-check',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'health_check' ],
				'permission_callback' => [ $this, 'check_api_permissions' ],
			]
		);

		/**
		 * Register a route to get api key option.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/secret-key',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_secret_key' ],
					'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ $this, 'regenerate_secret_key' ],
					'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
				],
			]
		);

		/**
		 * Register a route which will store array of sites data like site name, site url, its GitHub repo and api key.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/shared-sites',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_shared_sites' ],
					'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'set_shared_sites' ],
					'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
					'args'                => [
						'sites_data' => [
							'required'          => true,
							'type'              => 'array',
							'validate_callback' => 'rest_validate_request_arg',
						],
					],
				],
			]
		);

		/**
		 * Register a route to manage governing site.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/governing-site',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_governing_site' ],
					'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'remove_governing_site' ],
					'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
				],
			],
		);
	}

	/**
	 * Health check endpoint.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function health_check(): WP_REST_Response|\WP_Error {

		return rest_ensure_response(
			[
				'success' => true,
				'message' => __( 'Health check passed successfully.', 'oneupdate' ),
			]
		);
	}

	/**
	 * Get governing site url.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_governing_site(): WP_REST_Response|\WP_Error {
		$governing_site_url = Settings::get_parent_site_url();

		return rest_ensure_response(
			[
				'success'            => true,
				'governing_site_url' => $governing_site_url,
			]
		);
	}

	/**
	 * Remove governing site url.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function remove_governing_site(): WP_REST_Response|\WP_Error {
		delete_option( Settings::OPTION_CONSUMER_PARENT_SITE_URL );

		return rest_ensure_response(
			[
				'success' => true,
				'message' => __( 'Governing site removed successfully.', 'oneupdate' ),
			]
		);
	}

	/**
	 * Get the secret key.
	 */
	public function get_secret_key(): \WP_REST_Response|\WP_Error {
		$secret_key = Settings::get_api_key();

		return new \WP_REST_Response(
			[
				'success'    => true,
				'secret_key' => $secret_key,
			]
		);
	}

	/**
	 * Regenerate the secret key.
	 */
	public function regenerate_secret_key(): \WP_REST_Response|\WP_Error {

		$regenerated_key = Settings::regenerate_api_key();

		return new \WP_REST_Response(
			[
				'success'    => true,
				'message'    => __( 'Secret key regenerated successfully.', 'oneupdate' ),
				'secret_key' => $regenerated_key,
			]
		);
	}

	/**
	 * Get shared sites data.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_shared_sites(): WP_REST_Response|\WP_Error {
		$shared_sites = Settings::get_shared_sites();
		return rest_ensure_response(
			[
				'success'      => true,
				'shared_sites' => array_values( $shared_sites ),
			]
		);
	}

	/**
	 * Set shared sites data.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function set_shared_sites( WP_REST_Request $request ): WP_REST_Response|\WP_Error {

		$body         = $request->get_body();
		$decoded_body = json_decode( $body, true );
		$sites_data   = $decoded_body['sites_data'] ?? [];

		// check if same url exists more than once or not.
		$urls = [];
		foreach ( $sites_data as $site ) {
			if ( isset( $site['url'] ) && in_array( $site['url'], $urls, true ) ) {
				return new \WP_Error( 'duplicate_site_url', __( 'Brand Site already exists.', 'oneupdate' ), [ 'status' => 400 ] );
			}

			// Add a unique ID if it doesn't exist.
			$site['id'] = $site['id'] ?? wp_generate_uuid4();

			$urls[] = $site['url'] ?? '';
		}

		$success = Settings::set_shared_sites( $sites_data );

		return rest_ensure_response(
			[
				'success'      => $success,
				'shared_sites' => array_values( $sites_data ),
			]
		);
	}
}
