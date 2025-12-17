<?php
/**
 * This is routes for Settings options.
 *
 * @package OneUpdate
 */

namespace OneUpdate\Modules\Rest;

use OneUpdate\Modules\Plugin\Settings as Plugin_Settings;
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
					'permission_callback' => [ self::class, 'permission_callback' ],
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ $this, 'regenerate_secret_key' ],
					'permission_callback' => [ self::class, 'permission_callback' ],
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
					'permission_callback' => [ self::class, 'permission_callback' ],
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'remove_governing_site' ],
					'permission_callback' => [ self::class, 'permission_callback' ],
				],
			],
		);

		/**
		 * Register a route to get all public and private repo from GitHub.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/github-repos',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_gh_repos' ],
				'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
			]
		);
				/**
		 * Register a route to get and set S3 credentials.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/s3-credentials',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_s3_credentials' ],
					'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
					},
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'set_s3_credentials' ],
					'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
					},
					'args'                => [
						's3_credentials' => [
							'required'          => true,
							'type'              => 'array',
							'sanitize_callback' => static function ( $value ) {
								return is_array( $value );
							},
						],
					],
				],
			]
		);

				/**
		 * Register a route to get and set github repo token.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/github-token',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_github_token' ],
					'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
					},
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'set_github_token' ],
					'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
					},
					'args'                => [
						'token' => [
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						],
					],
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
	 *
	 * @return \WP_REST_Response| \WP_Error
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
	 *
	 * @return \WP_REST_Response|\WP_Error
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

	/**
	 * Get all public and private GitHub repositories from rtCamp and wpcomvip organizations.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_gh_repos(): \WP_REST_Response|\WP_Error {

		// check into transient first.
		$cached_repos = get_transient( 'oneupdate_gh_repos' );
		if ( false !== $cached_repos ) {
			return rest_ensure_response(
				[
					'success' => true,
					'repos'   => $cached_repos,
					'count'   => count( $cached_repos ),
				]
			);
		}

		$github_token = Plugin_Settings::get_github_token();

		if ( empty( $github_token ) ) {
			return new \WP_Error( 'no_github_token', __( 'GitHub token not found.', 'oneupdate' ), [ 'status' => 404 ] );
		}

		// Loop to fetch all GitHub repos using pagination.
		$all_repos = [];
		$page      = 1;
		$per_page  = 100;

		do {
			$fetch_url = "https://api.github.com/user/repos?affiliation=owner,organization,collaborator&per_page={$per_page}&page={$page}";

			$response = wp_safe_remote_get(
				$fetch_url,
				[
					'headers' => [
						'Authorization' => 'Bearer ' . $github_token,
						'Accept'        => 'application/vnd.github.v3+json',
						'User-Agent'    => 'OneUpdate Plugin Loader',
					],
					'timeout' => 30, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
				]
			);

			if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
				return new \WP_Error(
					'github_api_error',
					__( 'Failed to fetch GitHub repositories.', 'oneupdate' ),
					[
						'status'   => 500,
						'error'    => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_response_code( $response ),
						'response' => $response,
					]
				);
			}

			$repos = json_decode( wp_remote_retrieve_body( $response ), true );

			if ( empty( $repos ) || ! is_array( $repos ) ) {
				break;
			}

			$all_repos = array_merge( $all_repos, $repos );

			++$page;

			$repos_count = count( $repos );
		} while ( $repos_count === $per_page );

		// Filter for specific organizations.
		$filtered_repos = [];
		foreach ( $all_repos as $repo ) {
			$filtered_repos[] = [
				'slug' => $repo['full_name'],
				'name' => $repo['name'],
				'url'  => $repo['html_url'],
			];
		}

		if ( empty( $filtered_repos ) ) {
			return new \WP_Error( 'no_filtered_repos', __( 'No repositories found for rtCamp or wpcomvip.', 'oneupdate' ), [ 'status' => 404 ] );
		}

		// Cache the result for 10 minutes.
		set_transient( 'oneupdate_gh_repos', $filtered_repos, 10 * MINUTE_IN_SECONDS );

		return rest_ensure_response(
			[
				'success' => true,
				'repos'   => $filtered_repos,
				'count'   => count( $filtered_repos ),
			]
		);
	}

		/**
		 * Get S3 credentials.
		 *
		 * @return \WP_REST_Response|\WP_Error
		 */
	public function get_s3_credentials(): \WP_REST_Response|\WP_Error {
		$s3_credentials = Plugin_Settings::get_s3_credentials();

		return rest_ensure_response(
			[
				'success'        => true,
				's3_credentials' => $s3_credentials,
			]
		);
	}

	/**
	 * Set S3 credentials.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function set_s3_credentials( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {

		$body           = $request->get_body();
		$decoded_body   = json_decode( $body, true );
		$s3_credentials = $decoded_body['s3_credentials'] ?? [];
		if ( ! is_array( $s3_credentials ) ) {
			return new \WP_Error( 'invalid_s3_credentials', __( 'Invalid S3 credentials provided.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		// Validate S3 credentials.
		$required_keys = [ 'accessKey', 'bucketName', 'endpoint', 'region', 'secretKey' ];
		foreach ( $required_keys as $key ) {
			if ( ! isset( $s3_credentials[ $key ] ) || empty( $s3_credentials[ $key ] ) ) {
				return new \WP_Error( 'invalid_s3_credentials', __( 'Invalid S3 credentials provided.', 'oneupdate' ), [ 'status' => 400 ] );
			}
		}

		// Save S3 credentials.
		$is_saved = Plugin_Settings::set_s3_credentials( $s3_credentials );

		return rest_ensure_response(
			[
				'success'        => $is_saved,
				's3_credentials' => $s3_credentials,
			]
		);
	}

	/**
	 * Get the GitHub token.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_github_token(): \WP_REST_Response|\WP_Error {
		$github_token = Plugin_Settings::get_github_token();

		return rest_ensure_response(
			[
				'success'      => true,
				'github_token' => $github_token,
			]
		);
	}

	/**
	 * Set the GitHub token.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function set_github_token( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {

		$github_token = sanitize_text_field( $request->get_param( 'token' ) );

		if ( empty( $github_token ) ) {
			return new \WP_Error( 'invalid_github_token', __( 'GitHub token is required.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		// check if the token is valid.
		$response = wp_safe_remote_get(
			'https://api.github.com/user',
			[
				'headers' => [
					'Authorization' => 'Bearer ' . $github_token,
					'Accept'        => 'application/vnd.github.v3+json',
					'User-Agent'    => 'OneUpdate Plugin Loader',
				],
				'timeout' => 30, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
			]
		);

		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return new \WP_Error(
				'invalid_github_token',
				__( 'Invalid GitHub token provided.', 'oneupdate' ),
				[
					'status' => 400,
					'error'  => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_response_code( $response ),
				]
			);
		}

		// Save GitHub token.
		$is_saved = Plugin_Settings::set_github_token( $github_token );

		return rest_ensure_response(
			[
				'success'      => $is_saved,
				'github_token' => $github_token,
			]
		);
	}
}
