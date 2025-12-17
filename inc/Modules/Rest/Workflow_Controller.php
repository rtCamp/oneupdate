<?php
/**
 * Class Workflow_Controller - this contains the REST API endpoints for managing GitHub workflows.
 *
 * @package OneUpdate
 */

namespace OneUpdate\Modules\Rest;

use OneUpdate\Modules\Plugin\Cache;
use OneUpdate\Modules\Plugin\Settings as Plugin_Settings;
use OneUpdate\Modules\Plugin\VIP_Activation;
use OneUpdate\Modules\Settings\Settings;

/**
 * Class Workflow_Controller
 */
class Workflow_Controller extends Abstract_REST_Controller {

	/**
	 * Active plugins options key.
	 *
	 * @var string
	 */
	public const ACTIVE_PLUGINS = 'active_plugins';

	/**
	 * {@inheritDoc}
	 */
	public function register_routes(): void {
		/**
		 * Register a route to apply plugins to sites by creating PR's to privided github repo's.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/apply-plugins',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'apply_plugins_to_selected_sites' ],
				'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
				},
				'args'                => [
					'sites'   => [
						'required'          => true,
						'type'              => 'array',
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value );
						},
					],
					'plugins' => [
						'required'          => true,
						'type'              => 'array',
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value );
						},
					],
				],
			]
		);

		/**
		 * Register a route to get all plugins.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/get_plugins',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_plugins' ],
				'permission_callback' => [ $this, 'check_api_permissions' ],
			]
		);

		/**
		 * Register a route to update options for oneupdate managed plugins.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/oneupdate-plugins-options',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_oneupdate_plugins_options' ],
					'permission_callback' => [ $this, 'check_api_permissions' ],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'update_oneupdate_plugins_options' ],
					'permission_callback' => [ $this, 'check_api_permissions' ],
					'args'                => [
						'options' => [
							'required'          => true,
							'type'              => 'array',
							'sanitize_callback' => static function ( $value ) {
								return is_array( $value );
							},
						],
					],
				],
			],
		);
		/**
		 * Register a route to apply private plugins to selected sites.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/apply-private-plugins',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'apply_private_plugins_to_selected_sites' ],
				'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
				},
				'args'                => [
					'sites'   => [
						'required'          => true,
						'type'              => 'array',
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value );
						},
					],
					'plugins' => [
						'required'          => true,
						'type'              => 'array',
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value );
						},
					],
				],
			]
		);

		/**
		 * Register a route for plugin action execution.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/execute-plugin-action',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'execute_plugin_action' ],
				'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
				},
				'args'                => [
					'action'           => [
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'slug'             => [
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'plugin_version'   => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'sites'            => [
						'required'          => true,
						'type'              => 'array',
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value );
						},
					],
					'plugin_type'      => [
						'required'          => false,
						'type'              => 'string',
						'default'           => 'public',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'plugin_path_info' => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			]
		);

		/**
		 * Register a route for bulk plugin update.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/bulk-plugin-update',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'bulk_plugin_update' ],
				'permission_callback' => static function () {
						return current_user_can( 'manage_options' );
				},
				'args'                => [
					'plugins' => [
						'required'          => true,
						'type'              => 'array',
						'sanitize_callback' => static function ( $value ) {
							return is_array( $value );
						},
					],
				],
			]
		);

		/**
		 * Register a route for WebHook to trigger transient rebuild.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/webhook/rebuild-transient',
			[
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'webhook_rebuild_transient' ],
					'permission_callback' => [ $this, 'webhook_permission_callback' ],
				],
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'webhook_rebuild_transient' ],
					'args'                => [
						'secret' => [
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						],
					],
					'permission_callback' => [ $this, 'webhook_permission_callback' ],
				],
			]
		);
	}

	/**
	 * Webhook permission callback.
	 *
	 * @return bool
	 */
	public function webhook_permission_callback(): bool {
		$secret       = isset( $_GET['secret'] ) ? sanitize_text_field( wp_unslash( $_GET['secret'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no need for nonce as its called from webhook like vip or github.
		$valid_secret = Settings::get_api_key();
		return hash_equals( $secret, $valid_secret );
	}

	/**
	 * Webhook to trigger transient rebuild.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function webhook_rebuild_transient(): \WP_REST_Response|\WP_Error {

		// Clear the transient.
		delete_transient( Cache::TRANSIENT_GET_PLUGINS );

		// Rebuild the transient.
		Cache::build_plugins_transient();

		return rest_ensure_response(
			[
				'success' => true,
				'message' => __( 'Transient rebuilt successfully.', 'oneupdate' ),
			]
		);
	}

	/**
	 * Bulk plugin update.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_plugin_update( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$body         = $request->get_body();
		$decoded_body = json_decode( $body, true );
		$plugins      = $decoded_body['plugins'] ?? [];

		if ( ! is_array( $plugins ) || empty( $plugins ) ) {
			return new \WP_Error( 'invalid_plugins', __( 'Invalid plugins provided.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		$response = [];

		foreach ( $plugins as $plugin ) {
			$sites = $plugin['sites'] ?? [];
			foreach ( $sites as $site ) {
				if ( ! is_string( $site ) || empty( $site ) ) {
					return new \WP_Error( 'invalid_site', __( 'Invalid site provided.', 'oneupdate' ), [ 'status' => 400 ] );
				}

				$oneupdate_sites = Settings::get_shared_sites();
				$plugin_slug     = $plugin['slug'] ?? '';
				$plugin_version  = $plugin['version'] ?? '';
				$gh_repo         = $oneupdate_sites[ $site ]['gh_repo'] ?? '';
				$plugin_type     = $plugin['plugin_type'] ?? 'public';

				if ( empty( $gh_repo ) || empty( $plugin_slug ) || empty( $plugin_version ) || 'public' !== $plugin_type ) {
					continue;
				}

				// Trigger GitHub action to update the plugin.
				$github_response         = $this->trigger_github_action_for_pr_creation(
					$gh_repo,
					'production',
					$plugin_slug,
					$plugin_version,
					'add_update',
					$oneupdate_sites[ $site ]['name'] ?? ''
				);
				$github_response['name'] = $site;
				$response[]              = [
					'github_response' => $github_response,
				];
			}
		}

		return rest_ensure_response(
			[
				'success'  => true,
				'message'  => __( 'Bulk plugin update initiated successfully.', 'oneupdate' ),
				'response' => $response,
			]
		);
	}

	/**
	 * Execute plugin action.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function execute_plugin_action( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$body             = $request->get_body();
		$decoded_body     = json_decode( $body, true );
		$action           = $decoded_body['action'] ?? '';
		$slug             = $decoded_body['slug'] ?? '';
		$plugin_version   = $decoded_body['plugin_version'] ?? '';
		$sites            = $decoded_body['sites'] ?? [];
		$plugin_type      = $decoded_body['plugin_type'] ?? 'public';
		$plugin_path_info = $decoded_body['plugin_path_info'] ?? '';

		if ( ! in_array( $action, [ 'activate', 'deactivate', 'update', 'remove', 'change-version', 'install' ], true ) ) {
			return new \WP_Error( 'invalid_action', __( 'Invalid action provided.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		if ( empty( $slug ) || ! is_string( $slug ) ) {
			return new \WP_Error( 'invalid_slug', __( 'Invalid plugin slug provided.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		if ( ! is_array( $sites ) || empty( $sites ) ) {
			return new \WP_Error( 'invalid_sites', __( 'Invalid sites provided.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		$output = [];
		$errors = [];
		if ( 'activate' === $action || 'deactivate' === $action || 'remove' === $action ) {
			foreach ( $sites as $site ) {
				$oneupdate_sites = Settings::get_shared_sites();
				$api_key         = $oneupdate_sites[ $site ]['api_key'] ?? '';

				$request_postfix = '/wp-json/' . self::NAMESPACE . '/oneupdate-plugins-options';
				// strip the trailing slash from the site URL.
				$site_url = rtrim( $oneupdate_sites[ $site ]['url'], '/' );

				if ( empty( $api_key ) ) {
					continue;
				}

				$response = wp_remote_post(
					$site_url . $request_postfix,
					[
						'headers' => [
							'Content-Type'      => 'application/json',
							'X-OneUpdate-Token' => $api_key,
						],
						'body'    => wp_json_encode(
							[
								'options' => [
									'plugins'     => [ $plugin_path_info ],
									'plugin_type' => $action,
								],
							]
						),
						'timeout' => 30, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
					]
				);
				if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
					$errors[] = new \WP_Error(
						'plugin_action_error',
						sprintf(
							/* translators: %s is the site URL */
							__( 'Failed to execute plugin action on site %s.', 'oneupdate' ),
							$site
						),
						[
							'status'   => 500,
							'response' => $response,
							'error'    => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_body( $response ),
						]
					);
				} else {
					$body         = wp_remote_retrieve_body( $response );
					$decoded_body = json_decode( $body, true );

					if ( isset( $decoded_body['success'] ) && $decoded_body['success'] ) {
						$output[] = [
							'site'             => $site,
							'action'           => $action,
							'slug'             => $slug,
							'status'           => 'success',
							'response'         => $decoded_body,
							'plugin_info_path' => $plugin_path_info,
						];
					} else {
						$errors[] = new \WP_Error(
							'plugin_action_error',
							sprintf(
								/* translators: %s is the site URL */
								__( 'Failed to execute plugin action on site %s.', 'oneupdate' ),
								$site
							),
							[
								'status'   => 500,
								'response' => $response,
								'error'    => isset( $decoded_body['message'] ) ? $decoded_body['message'] : __( 'Unknown error occurred.', 'oneupdate' ),
							]
						);
					}
				}
			}
		}
		if ( 'update' === $action || 'change-version' === $action ) {
			foreach ( $sites as $site ) {
				$oneupdate_sites = Settings::get_shared_sites();
				$gh_repo         = $oneupdate_sites[ $site ]['gh_repo'] ?? '';
				if ( empty( $gh_repo ) ) {
					$errors[] = new \WP_Error(
						'no_gh_repo',
						sprintf(
							/* translators: %s is the site URL */
							__( 'GitHub repository not found for site %s.', 'oneupdate' ),
							$site
						),
						[ 'status' => 404 ]
					);
					continue;
				}

				$response = $this->trigger_github_action_for_pr_creation(
					$gh_repo,
					'production',
					$slug,
					$plugin_version,
					'add_update',
					$oneupdate_sites[ $site ]['name'] ?? ''
				);

				if ( is_wp_error( $response ) ) {
					$errors[] = $response;
				} else {
					$output[] = [
						'site'     => $site,
						'action'   => $action,
						'slug'     => $slug,
						'status'   => 'success',
						'response' => $response,
					];
				}
			}
		}
		if ( 'remove' === $action ) {
			foreach ( $sites as $site ) {
				$oneupdate_sites = Settings::get_shared_sites();
				$gh_repo         = $oneupdate_sites[ $site ]['gh_repo'] ?? '';
				if ( empty( $gh_repo ) ) {
					$errors[] = new \WP_Error(
						'no_gh_repo',
						sprintf(
							/* translators: %s is the site URL */
							__( 'GitHub repository not found for site %s.', 'oneupdate' ),
							$site
						),
						[ 'status' => 404 ]
					);
					continue;
				}

				$response = $this->trigger_github_action_for_pr_creation(
					$gh_repo,
					'production',
					$slug,
					'',
					'remove',
					$oneupdate_sites[ $site ]['name'] ?? ''
				);

				if ( is_wp_error( $response ) ) {
					$errors[] = $response;
				} else {
					$output[] = [
						'site'     => $site,
						'action'   => $action,
						'slug'     => $slug,
						'status'   => 'success',
						'response' => $response,
					];
				}
			}
		}
		if ( 'install' === $action ) {
			foreach ( $sites as $site ) {
				$oneupdate_sites = Settings::get_shared_sites();
				$gh_repo         = $oneupdate_sites[ $site ]['gh_repo'] ?? '';
				if ( empty( $gh_repo ) ) {
					$errors[] = new \WP_Error(
						'no_gh_repo',
						sprintf(
							/* translators: %s is the site URL */
							__( 'GitHub repository not found for site %s.', 'oneupdate' ),
							$site
						),
						[ 'status' => 404 ]
					);
					continue;
				}

				$response = $this->trigger_github_action_for_pr_creation(
					$gh_repo,
					'production',
					$slug,
					$plugin_version,
					'add_update',
					$oneupdate_sites[ $site ]['name'] ?? ''
				);

				if ( is_wp_error( $response ) ) {
					$errors[] = $response;
				} else {
					$output[] = [
						'site'     => $site,
						'action'   => $action,
						'slug'     => $slug,
						'status'   => 'success',
						'response' => $response,
					];
				}
			}
		}

		return rest_ensure_response(
			[
				'success'     => count( $errors ) === 0,
				'message'     => __( 'Plugin action executed successfully.', 'oneupdate' ),
				'output'      => $output,
				'errors'      => $errors,
				'plugin_type' => $plugin_type,
			]
		);
	}

	/**
	 * Apply plugins to selected sites.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function apply_private_plugins_to_selected_sites( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$body         = $request->get_body();
		$decoded_body = json_decode( $body, true );
		$sites_data   = $decoded_body['sites'] ?? [];
		$plugins      = $decoded_body['plugins'] ?? [];
		if ( ! is_array( $sites_data ) || ! is_array( $plugins ) ) {
			return new \WP_Error( 'invalid_data', __( 'Invalid data provided.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		// for each sites, apply the plugins.
		$results = [];
		foreach ( $sites_data as $site_data ) {
			$site_name = $site_data['name'] ?? '';
			$site_url  = $site_data['url'] ?? '';
			$repo_url  = $site_data['gh_repo'] ?? '';

			if ( empty( $site_name ) || empty( $site_url ) || empty( $repo_url ) ) {
				$results[] = [
					'site'    => $site_name,
					'status'  => 'error',
					'message' => __( 'Invalid site data provided.', 'oneupdate' ),
				];
				continue;
			}
			foreach ( $plugins as $private_plugin ) {
				$results[] = $this->trigger_github_action_for_private_plugin(
					$repo_url,
					$private_plugin,
					'production',
					$site_name
				);
			}
		}

		return rest_ensure_response(
			[
				'success' => true,
				'results' => $results,
			]
		);
	}

	/**
	 * Trigger GitHub action for private plugin.
	 *
	 * @param string $repo           The GitHub repository.
	 * @param string $private_plugin The private plugin zip URL.
	 * @param string $branch         The branch to create PR against.
	 * @param string $site_name      The site name for which the action is triggered.
	 *
	 * @return array|\WP_Error
	 */
	private function trigger_github_action_for_private_plugin( string $repo, string $private_plugin, string $branch, string $site_name ): array|\WP_Error {
		$github_token = Plugin_Settings::get_github_token();

		if ( empty( $github_token ) ) {
			return new \WP_Error( 'no_github_token', __( 'GitHub token not found.', 'oneupdate' ), [ 'status' => 404 ] );
		}

		$action_url = "https://api.github.com/repos/{$repo}/actions/workflows/oneupdate-pr-creation-private.yml/dispatches";

		// pass the zip file as input to the GitHub action.
		$response = wp_safe_remote_post(
			$action_url,
			[
				'headers' => [
					'Authorization' => 'Bearer ' . $github_token,
					'Accept'        => 'application/vnd.github.v3+json',
					'User-Agent'    => 'OneUpdate Plugin Loader',
				],
				'timeout' => 30, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
				'body'    => wp_json_encode(
					[
						'ref'    => $branch,
						'inputs' => [
							'zip_url' => $private_plugin,
						],
					]
				),
			],
		);

		if ( is_wp_error( $response ) || 204 !== wp_remote_retrieve_response_code( $response ) ) {
			return new \WP_Error(
				'github_action_error',
				__( 'Failed to trigger GitHub action for PR creation.', 'oneupdate' ),
				[
					'status' => 500,
					'error'  => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_response_code( $response ),
				]
			);
		}

		// If the request was successful, return the response.
		$response_code = wp_remote_retrieve_response_code( $response );

		if ( is_wp_error( $response ) || 204 !== $response_code ) {
			return new \WP_Error(
				'github_action_error',
				__( 'Failed to trigger GitHub action for PR creation.', 'oneupdate' ),
				[
					'status' => 500,
					'error'  => is_wp_error( $response ) ? $response->get_error_message() : $response_code,
				]
			);
		}

		sleep( 2 ); // this is to make sure workflow is triggered.

		// Try to get the workflow run ID.
		$run_id = $this->get_latest_workflow_run_id( $repo, 'oneupdate-pr-creation-private.yml' );

		return [
			'success'       => true,
			'repo'          => $repo,
			'branch'        => $branch,
			'message'       => __( 'GitHub Action workflow dispatched successfully', 'oneupdate' ),
			'response_code' => $response_code,
			'workflow_url'  => "https://github.com/{$repo}/actions/workflows/oneupdate-pr-creation-private.yml",
			'run_id'        => $run_id,
			'run_url'       => $run_id ? "https://github.com/{$repo}/actions/runs/{$run_id}" : null,
			'name'          => $site_name,
		];
	}

	/**
	 * Get onpress plugins options.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_oneupdate_plugins_options(): \WP_REST_Response|\WP_Error {
		$options = VIP_Activation::get_plugins_options();

		return rest_ensure_response(
			[
				'success' => true,
				'options' => $options,
			]
		);
	}

	/**
	 * Update oneupdate plugins options.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_oneupdate_plugins_options( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$body            = $request->get_body();
		$decoded_body    = json_decode( $body, true );
		$request_options = $decoded_body['options'] ?? [];

		if ( ! is_array( $request_options ) ) {
			return new \WP_Error( 'invalid_options', __( 'Invalid options provided.', 'oneupdate' ), [ 'status' => 400 ] );
		}

		// from request options get plugins and plugin type.
		$plugins     = $request_options['plugins'] ?? [];
		$plugin_type = $request_options['plugin_type'] ?? 'add_update';

		// oneupdate_plugin_activate options.
		$oneupdate_plugin_activate = VIP_Activation::get_plugins_options();

		// if plugin type is deactivate/remove then remove the plugin from options.
		if ( 'deactivate' === $plugin_type || 'remove' === $plugin_type ) {
			// get active plugins options.
			$active_plugins = get_option( self::ACTIVE_PLUGINS, [] );
			// remove the plugins from active plugins options.
			foreach ( $plugins as $plugin ) {
				if ( in_array( $plugin, $active_plugins, true ) ) {
					deactivate_plugins( $plugin, true );
					$active_plugins = array_diff( $active_plugins, [ $plugin ] );
				}
				if ( ! isset( $oneupdate_plugin_activate[ $plugin ] ) ) {
					continue;
				}

				unset( $oneupdate_plugin_activate[ $plugin ] );
			}
			// update the active plugins options.
			update_option( self::ACTIVE_PLUGINS, $active_plugins );
		}
		if ( 'activate' === $plugin_type ) {
			// if plugin type is activate then activate the plugins.
			$active_plugins = get_option( self::ACTIVE_PLUGINS, [] );
			foreach ( $plugins as $plugin ) {
				if ( ! in_array( $plugin, $active_plugins, true ) ) {
					activate_plugin( $plugin, '', false, true );
					$active_plugins[] = $plugin;
				}
				if ( isset( $oneupdate_plugin_activate[ $plugin ] ) ) {
					continue;
				}

				$oneupdate_plugin_activate[ $plugin ] = $plugin;
			}
		}
		update_option( VIP_Activation::PLUGINS_OPTIONS, $oneupdate_plugin_activate );

		if ( ! empty( $plugins ) ) {
			Cache::rebuild_transient_for_single_plugin(
				$plugins[0],
				'activate' === $plugin_type,
				'deactivate' === $plugin_type
			);
		}

		return rest_ensure_response(
			[
				'success'     => true,
				'plugin_type' => $plugin_type,
				'plugins'     => $plugins,
			]
		);
	}

	/**
	 * Get all plugins.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_plugins(): \WP_REST_Response|\WP_Error {

		// check if oneupdate_get_plugins cache is set.
		$cached_plugins = get_transient( Cache::TRANSIENT_GET_PLUGINS );
		if ( false !== $cached_plugins ) {
			return rest_ensure_response(
				[
					'success' => true,
					'plugins' => json_decode( $cached_plugins ),
				]
			);
		}

		$reconstructed_plugins = Cache::build_plugins_transient();

		return rest_ensure_response(
			[
				'success' => true,
				'plugins' => $reconstructed_plugins,
			]
		);
	}

	/**
	 * Apply plugins to selected sites.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function apply_plugins_to_selected_sites( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$body         = $request->get_body();
		$decoded_body = json_decode( $body, true );
		$sites        = $decoded_body['sites'] ?? [];
		$plugins      = $decoded_body['plugins'] ?? [];
		$plugin_type  = $decoded_body['plugin_type'] ?? 'add_update';
		$created_pr   = [];
		$error_logs   = [];

		foreach ( $sites as $site ) {
			if ( ! isset( $site['gh_repo'] ) ) {
				return new \WP_Error( 'invalid_site_data', __( 'Invalid site data provided.', 'oneupdate' ), [ 'status' => 400 ] );
			}

			foreach ( $plugins as $plugin ) {
				// Create GitHub PR for each plugin.
				$pr_response  = $this->trigger_github_action_for_pr_creation( $site['gh_repo'], 'production', $plugin['slug'], $plugin['version'], $plugin_type, $site['name'] ?? '' );
				$created_pr[] = $pr_response;
			}
			// set oneupdate_plugins_options for all sites.
			$request_postfix = '/wp-json/' . self::NAMESPACE . '/oneupdate-plugins-options';
			$site_url        = $site['url'] ?? '';
			$token           = $site['api_key'] ?? '';
			if ( ! empty( $site_url ) ) {
				$site_url        = rtrim( $site_url, '/' );
				$request_postfix = $site_url . '/' . $request_postfix;
			}

			// if current site is same as site_url then use current site token.
			if ( empty( $token ) ) {
				$token = Settings::get_api_key();
			}

			// create comma separated string array of plugins.
			$slug_array_of_plugins = [];
			foreach ( $plugins as $plugin ) {
				$slug_array_of_plugins[] = $plugin['slug'];
			}

			$response = wp_remote_post(
				$request_postfix,
				[
					'headers' => [
						'Content-Type'      => 'application/json',
						'X-OneUpdate-Token' => $token,
					],
					'body'    => wp_json_encode(
						[
							'options' => [
								'plugins'     => $slug_array_of_plugins,
								'plugin_type' => $plugin_type,
							],
						]
					),
					'timeout' => 30, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
				]
			);
			if ( ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) === 200 ) {
				continue;
			}

			$error_logs[] = [
				'site'     => $site,
				'error'    => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_response_code( $response ),
				'status'   => wp_remote_retrieve_response_code( $response ),
				'response' => $response,
			];
		}

		return rest_ensure_response(
			[
				'success'     => count( $error_logs ) === 0,
				'created_prs' => $created_pr,
				'logs'        => $error_logs,
			]
		);
	}

	/**
	 * Trigger GitHub action for PR creation.
	 *
	 * @param string $repo   The GitHub repository slug.
	 * @param string $branch The branch to create the PR against.
	 * @param string $plugin_slug The plugin slug.
	 * @param string $version The plugin version.
	 * @param string $plugin_type The type of plugin action (add_update, deactivate, remove).
	 * @param string $site_name The site name for which the action is triggered.
	 *
	 * @return array|\WP_Error
	 */
	private function trigger_github_action_for_pr_creation( string $repo, string $branch, string $plugin_slug, string $version, string $plugin_type, string $site_name ): array|\WP_Error {
		$github_token = Plugin_Settings::get_github_token();

		if ( empty( $github_token ) ) {
			return new \WP_Error( 'no_github_token', __( 'GitHub token not found.', 'oneupdate' ), [ 'status' => 404 ] );
		}

		// construct plugin zip from plugin slug and version.
		$wordpress_plugin_api = 'https://downloads.wordpress.org/plugin/' . $plugin_slug . '.' . $version . '.zip';

		$action_url = "https://api.github.com/repos/{$repo}/actions/workflows/oneupdate-pr-creation.yml/dispatches";

		// pass the zip file as input to the GitHub action.
		$response = wp_safe_remote_post(
			$action_url,
			[
				'headers' => [
					'Authorization' => 'Bearer ' . $github_token,
					'Accept'        => 'application/vnd.github.v3+json',
					'User-Agent'    => 'OneUpdate Plugin Loader',
				],
				'timeout' => 30, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
				'body'    => wp_json_encode(
					[
						'ref'    => $branch,
						'inputs' => [
							'plugin_slug' => $plugin_slug,
							'version'     => $version,
							'zip_url'     => $wordpress_plugin_api,
							'plugin_type' => $plugin_type,
						],
					]
				),
			],
		);

		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 204 ) {
			return new \WP_Error(
				'github_action_error',
				__( 'Failed to trigger GitHub action for PR creation.', 'oneupdate' ),
				[
					'status'               => 500,
					'plugin'               => $plugin_slug,
					'version'              => $version,
					'branch'               => $branch,
					'repo'                 => $repo,
					'plugin_type'          => $plugin_type,
					'wordpress_plugin_api' => $wordpress_plugin_api,
					'response'             => $response,
					'error'                => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_response_code( $response ),
				]
			);
		}

		// If the request was successful, return the response.
		$response_code = wp_remote_retrieve_response_code( $response );

		if ( is_wp_error( $response ) || 204 !== $response_code ) {
			return new \WP_Error(
				'github_action_error',
				__( 'Failed to trigger GitHub action for PR creation.', 'oneupdate' ),
				[
					'status'      => 500,
					'plugin'      => $plugin_slug,
					'version'     => $version,
					'branch'      => $branch,
					'repo'        => $repo,
					'plugin_type' => $plugin_type,
					'error'       => is_wp_error( $response ) ? $response->get_error_message() : $response_code,
				]
			);
		}

		sleep( 2 ); // this is to make sure workflow is triggered.

		// Try to get the workflow run ID.
		$run_id = $this->get_latest_workflow_run_id( $repo, 'oneupdate-pr-creation.yml' );

		return [
			'success'       => true,
			'repo'          => $repo,
			'branch'        => $branch,
			'plugin'        => $plugin_slug,
			'version'       => $version,
			'message'       => __( 'GitHub Action workflow dispatched successfully', 'oneupdate' ),
			'response_code' => $response_code,
			'workflow_url'  => "https://github.com/{$repo}/actions/workflows/oneupdate-pr-creation.yml",
			'run_id'        => $run_id,
			'run_url'       => $run_id ? "https://github.com/{$repo}/actions/runs/{$run_id}" : null,
			'name'          => $site_name,
		];
	}

	/**
	 * Get the latest workflow run ID for a given repository and workflow filename.
	 *
	 * @param string $repo             The GitHub repository slug.
	 * @param string $workflow_filename The workflow filename.
	 *
	 * @return string|null The latest workflow run ID or null if not found.
	 */
	private function get_latest_workflow_run_id( string $repo, string $workflow_filename ): string|null {
		$github_token = Plugin_Settings::get_github_token();

		if ( empty( $github_token ) ) {
			return null;
		}

		$runs_url = "https://api.github.com/repos/{$repo}/actions/workflows/{$workflow_filename}/runs?per_page=1";

		$response = wp_safe_remote_get(
			$runs_url,
			[
				'headers' => [
					'Authorization' => 'Bearer ' . $github_token,
					'Accept'        => 'application/vnd.github.v3+json',
					'User-Agent'    => 'OneUpdate Plugin Loader',
				],
				'timeout' => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
			]
		);

		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return null;
		}

		$response_body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( empty( $response_body['workflow_runs'] ) ) {
			return null;
		}

		return $response_body['workflow_runs'][0]['id'] ?? null;
	}
}
