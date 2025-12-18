<?php
/**
 * Class GitHub_Pull_Requests which contains routes for GH PR's.
 *
 * @package OneUpdate
 */

namespace OneUpdate\Modules\Rest;

use OneUpdate\Modules\Plugin\Settings as Plugin_Settings;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Class GH_Pull_Request_Controller
 */
class GH_Pull_Request_Controller extends Abstract_REST_Controller {

	/**
	 * GitHub API base URL.
	 *
	 * @var string
	 */
	private const GH_API_BASE_URL = 'https://api.github.com';

	/**
	 * Namespace for the REST API.
	 *
	 * @var string
	 */
	public const NAMESPACE = parent::NAMESPACE . '/github';

	/**
	 * {@inheritDoc}
	 */
	public function register_routes(): void {
		/**
		 * Register a route to get pull requests by pagination.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/pull-requests/(?P<owner>[a-zA-Z0-9._-]+)/(?P<repo>[a-zA-Z0-9._-]+)',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_pull_requests' ],
					'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
					'args'                => [
						'owner'        => [
							'required' => true,
							'type'     => 'string',
						],
						'repo'         => [
							'required' => true,
							'type'     => 'string',
						],
						'pr_number'    => [
							'required' => false,
							'type'     => 'integer',
						],
						'state'        => [
							'required' => false,
							'type'     => 'string',
							'default'  => 'all',
							'enum'     => [ 'open', 'closed', 'all', 'merged' ],
						],
						'page'         => [
							'required' => false,
							'type'     => 'integer',
							'default'  => 1,
						],
						'per_page'     => [
							'required' => false,
							'type'     => 'integer',
							'default'  => 25,
							'maximum'  => 100,
							'minimum'  => 1,
						],
						'search_query' => [
							'required' => false,
							'type'     => 'string',
						],
					],
				],
			]
		);
	}

	/**
	 * Get pull requests by pagination.
	 *
	 * @param \WP_REST_Request $request The REST request.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_pull_requests( WP_REST_Request $request ): WP_REST_Response {
		$gh_owner     = sanitize_text_field( $request['owner'] );
		$gh_repo      = sanitize_text_field( $request['repo'] );
		$pr_number    = filter_var( $request->get_param( 'pr_number' ), FILTER_VALIDATE_INT ) ?? 0;
		$page         = filter_var( $request->get_param( 'page' ), FILTER_VALIDATE_INT ) ?: 1;
		$pr_state     = sanitize_text_field( $request->get_param( 'state' ) ) ?? 'all';
		$per_page     = filter_var( $request->get_param( 'per_page' ), FILTER_VALIDATE_INT ) ?: 25;
		$search_query = sanitize_text_field( $request->get_param( 'search_query' ) ) ?? '';

		// if pr_number & search query is not provided, get all pull requests.
		if ( empty( $pr_number ) && empty( $search_query ) ) {
			return self::get_all_pull_requests( $gh_owner, $gh_repo, $pr_state, $per_page, $page );
		}

		// if pr_number is not provided but search_query is provided, search pull requests.
		if ( ! empty( $search_query ) ) {
			return self::search_pull_requests( $gh_owner, $gh_repo, $search_query, $per_page, $page, $pr_state );
		}

		// if pr_number is provided, get specific pull request.
		return self::get_specific_pull_request( $gh_owner, $gh_repo, $pr_number );
	}

	/**
	 * Get all pull requests for a given repo.
	 *
	 * @param string $gh_owner GitHub owner.
	 * @param string $gh_repo GitHub repo.
	 * @param string $pr_state State of pull requests to fetch. Default is 'open'.
	 * @param int    $per_page Number of pull requests per page. Default is 25.
	 * @param int    $page Page number. Default is 1.
	 *
	 * @return \WP_REST_Response
	 */
	private static function get_all_pull_requests( string $gh_owner, string $gh_repo, string $pr_state = 'open', int $per_page = 25, int $page = 1 ): WP_REST_Response {

		// gh api endpoint to get pull requests.
		$gh_api_endpoint = self::GH_API_BASE_URL . "/repos/{$gh_owner}/{$gh_repo}/pulls";
		$query_args      = [
			'state'    => $pr_state,
			'per_page' => $per_page,
			'page'     => $page,
			'order'    => 'desc',
		];

		$gh_api_endpoint = \add_query_arg( $query_args, $gh_api_endpoint );

		$response = self::gh_api_request_with_validation( $gh_api_endpoint );

		if ( false === $response['success'] ) {
			return new WP_REST_Response(
				[
					'success' => false,
					'message' => $response['message'],
				],
				$response['status_code']
			);
		}

		$pull_requests = $response['data'] ?? [];
		$headers       = $response['headers'] ?? [];

		$pull_requests = self::format_github_pull_requests_info( $pull_requests );
		$total_count   = self::get_total_count_from_headers( $headers, count( $pull_requests ), $per_page );
		$total_pages   = ceil( $total_count / $per_page );

		$pull_requests_response = new WP_REST_Response(
			[
				'success'       => true,
				'pull_requests' => $pull_requests,
				'pagination'    => [
					'current_page' => $page,
					'per_page'     => $per_page,
					'total_pages'  => $total_pages,
					'total_count'  => $total_count,
				],
				'api'           => $gh_api_endpoint,
			],
			200
		);

		$pull_requests_response->header( 'X-WP-Total', (string) $total_count );
		$pull_requests_response->header( 'X-WP-TotalPages', (string) $total_pages );

		return $pull_requests_response;
	}

	/**
	 * Search pull requests in a given repo.
	 *
	 * @param string $gh_owner GitHub owner.
	 * @param string $gh_repo GitHub repo.
	 * @param string $search_query Search query.
	 * @param int    $per_page Number of pull requests per page. Default is 25.
	 * @param int    $page Page number. Default is 1.
	 * @param string $pr_state State of pull requests to fetch. Default is 'all'.
	 *
	 * @return \WP_REST_Response
	 */
	private static function search_pull_requests( string $gh_owner, string $gh_repo, string $search_query, int $per_page = 25, int $page = 1, string $pr_state = 'all' ): WP_REST_Response {

		// If we have a specific search query, use search API with state filter.
		if ( ! empty( $search_query ) && 'all' !== $pr_state ) {
			return self::search_pull_requests_with_query_and_state( $gh_owner, $gh_repo, $search_query, $per_page, $page, $pr_state );
		}

		$query_args = [];

		// If no search query or state is 'all', use the original search approach.
		if ( ! empty( $search_query ) ) {
			$gh_api_endpoint = self::GH_API_BASE_URL . '/search/issues';
			$query_args      = array_merge(
				$query_args,
				[
					'q' => $search_query . "+repo:{$gh_owner}/{$gh_repo}+type:pr",
				],
			);

			// Add state to search query if not 'all'.
			if ( 'all' !== $pr_state ) {
				$gh_api_endpoint .= "+state:{$pr_state}";
			}
		} else {
			// Use pulls API for better state filtering when no search query.
			$gh_api_endpoint = self::GH_API_BASE_URL . "/repos/{$gh_owner}/{$gh_repo}/pulls";
			$query_args      = array_merge(
				$query_args,
				[
					'state' => $pr_state,
				]
			);
		}

		$query_args      = array_merge(
			$query_args,
			[
				'per_page' => $per_page,
				'page'     => $page,
				'order'    => 'desc',
			],
		);
		$gh_api_endpoint = \add_query_arg( $query_args, $gh_api_endpoint );

		$response = self::gh_api_request_with_validation( $gh_api_endpoint );

		if ( false === $response['success'] ) {
			return new WP_REST_Response(
				[
					'success' => false,
					'message' => $response['message'],
				],
				$response['status_code']
			);
		}

		$results = $response['data'] ?? [];
		$headers = $response['headers'] ?? [];

		// Handle different response formats.
		if ( ! empty( $search_query ) ) {
			// Search API response.
			$pull_requests = isset( $results['items'] ) ? self::format_github_pull_requests_info( $results['items'] ) : [];
			$total_count   = $results['total_count'] ?? 0;
		} else {
			// Pulls API response.
			$pull_requests = self::format_github_pull_requests_info( $results );
			$total_count   = self::get_total_count_from_headers( $headers, count( $pull_requests ), $per_page );
		}

		$total_pages = ceil( $total_count / $per_page );

		$response_data = new WP_REST_Response(
			[
				'success'       => true,
				'pull_requests' => $pull_requests,
				'pagination'    => [
					'current_page' => $page,
					'per_page'     => $per_page,
					'total_pages'  => $total_pages,
					'total_count'  => $total_count,
				],
			],
			200
		);

		$response_data->header( 'X-WP-Total', (string) $total_count );
		$response_data->header( 'X-WP-TotalPages', (string) $total_pages );

		return $response_data;
	}

	/**
	 * Handle search with both query and state filters using multiple API calls if needed
	 *
	 * @param string $gh_owner GitHub owner.
	 * @param string $gh_repo GitHub repo.
	 * @param string $search_query Search query.
	 * @param int    $per_page Number of pull requests per page.
	 * @param int    $page Page number.
	 * @param string $pr_state State of pull requests to fetch.
	 *
	 * @return \WP_REST_Response
	 */
	private static function search_pull_requests_with_query_and_state( string $gh_owner, string $gh_repo, string $search_query, int $per_page, int $page, string $pr_state ): WP_REST_Response {

		// Use search API with state filter in query.
		$gh_api_endpoint = self::GH_API_BASE_URL . '/search/issues';
		$query_args      = [
			'q'        => $search_query . "+repo:{$gh_owner}/{$gh_repo}+type:pr+state:{$pr_state}",
			'per_page' => $per_page,
			'page'     => $page,
			'order'    => 'desc',
		];
		$gh_api_endpoint = \add_query_arg( $query_args, $gh_api_endpoint );

		$response = self::gh_api_request_with_validation( $gh_api_endpoint );

		if ( false === $response['success'] ) {
			return new WP_REST_Response(
				[
					'success' => false,
					'message' => $response['message'],
				],
				$response['status_code']
			);
		}

		$search_results = $response['data'] ?? [];
		$pull_requests  = isset( $search_results['items'] ) ? self::format_github_pull_requests_info( $search_results['items'] ) : [];
		$total_count    = $search_results['total_count'] ?? 0;
		$total_pages    = ceil( $total_count / $per_page );

		$response_data = new WP_REST_Response(
			[
				'success'       => true,
				'pull_requests' => $pull_requests,
				'pagination'    => [
					'current_page' => $page,
					'per_page'     => $per_page,
					'total_pages'  => $total_pages,
					'total_count'  => $total_count,
				],
			],
			200
		);

		$response_data->header( 'X-WP-Total', (string) $total_count );
		$response_data->header( 'X-WP-TotalPages', (string) $total_pages );

		return $response_data;
	}

	/**
	 * Extract total count from Link headers when using pulls API
	 *
	 * @param array|\WpOrg\Requests\Utility\CaseInsensitiveDictionary $headers Response headers.
	 * @param int                                                     $current_count Current count of items fetched.
	 * @param int                                                     $per_page Number of items per page. Default is 25.
	 *
	 * @return int Total count of items.
	 */
	private static function get_total_count_from_headers( array|\WpOrg\Requests\Utility\CaseInsensitiveDictionary $headers, int $current_count, int $per_page = 25 ): int {

		// if headers is instance of CaseInsensitiveDictionary, convert to array.
		if ( $headers instanceof \WpOrg\Requests\Utility\CaseInsensitiveDictionary ) {
			$headers = $headers->getAll();
		}

		if ( ! isset( $headers['link'] ) ) {
			return $current_count;
		}

		$link_header = $headers['link'] ?? '';

		// Parse the Link header to get last page.
		if ( preg_match( '/<[^>]*\/pulls\?[^>]*page=(\d+)[^>]*>;\s*rel=["\']last["\']/i', $link_header, $matches ) ) {
			$last_page = (int) $matches[1];
			// This is an approximation based on link header.
			return $last_page * $per_page;
		}
		return $current_count;
	}

	/**
	 * Get a specific pull request by its number.
	 *
	 * @param string $gh_owner GitHub owner.
	 * @param string $gh_repo GitHub repo.
	 * @param int    $pr_number Pull request number.
	 *
	 * @return \WP_REST_Response
	 */
	private static function get_specific_pull_request( string $gh_owner, string $gh_repo, int $pr_number ): WP_REST_Response {

		// gh api endpoint to get a specific pull request.
		$gh_api_endpoint = self::GH_API_BASE_URL . "/repos/{$gh_owner}/{$gh_repo}/pulls/{$pr_number}";

		$response = self::gh_api_request_with_validation( $gh_api_endpoint );

		if ( false === $response['success'] ) {
			return new WP_REST_Response(
				[
					'success' => false,
					'message' => $response['message'],
				],
				$response['status_code']
			);
		}

		$pull_request = $response['data'] ?? [];

		$pull_request = self::format_github_pull_requests_info( [ $pull_request ] );

		return new WP_REST_Response(
			[
				'success'      => true,
				'pull_request' => $pull_request,
			],
			200
		);
	}

	/**
	 * Format GitHub pull requests info to return only necessary fields.
	 *
	 * @param array $pull_requests Array of pull requests from GitHub API.
	 *
	 * @return array Formatted array of pull requests.
	 */
	private static function format_github_pull_requests_info( array $pull_requests ): array {
		$formatted_prs = [];
		foreach ( $pull_requests as $pr ) {
			$formatted_prs[] = [
				'id'            => $pr['id'] ?? '',
				'url'           => $pr['url'] ?? '',
				'number'        => $pr['number'] ?? '',
				'title'         => $pr['title'] ?? '',
				'user'          => isset( $pr['user'] ) ? [
					'login'      => $pr['user']['login'] ?? '',
					'avatar_url' => $pr['user']['avatar_url'] ?? '',
					'html_url'   => $pr['user']['html_url'] ?? '',
				] : null,
				'labels'        => $pr['labels'] ?? '',
				'state'         => $pr['state'] ?? '',
				'created_at'    => $pr['created_at'] ?? '',
				'updated_at'    => $pr['updated_at'] ?? '',
				'closed_at'     => $pr['closed_at'] ?? '',
				'html_url'      => $pr['html_url'] ?? '',
				'body'          => $pr['body'] ?? '',
				'pr_branch'     => isset( $pr['head'] ) ? ( $pr['head']['ref'] ?? '' ) : '',
				'base_branch'   => isset( $pr['base'] ) ? ( $pr['base']['ref'] ?? '' ) : '',
				'merged_at'     => $pr['merged_at'] ?? null,
				'merged'        => $pr['merged'] ?? null,
				'merged_by'     => isset( $pr['merged_by'] ) ? [
					'login'      => $pr['merged_by']['login'] ?? '',
					'avatar_url' => $pr['merged_by']['avatar_url'] ?? '',
					'html_url'   => $pr['merged_by']['html_url'] ?? '',
				] : null,

				'comments'      => $pr['comments'] ?? null,
				'commits'       => $pr['commits'] ?? null,
				'additions'     => $pr['additions'] ?? null,
				'deletions'     => $pr['deletions'] ?? null,
				'changed_files' => $pr['changed_files'] ?? null,
				'rebaseable'    => $pr['rebaseable'] ?? null,
				'draft'         => $pr['draft'] ?? null,
				'auto_merge'    => $pr['auto_merge'] ?? null,

			];
		}
		return $formatted_prs;
	}

	/**
	 * Make a GitHub API request with validation.
	 *
	 * @param string $endpoint GitHub API endpoint.
	 *
	 * @return array Array containing success status, data, headers, status_code, and message.
	 */
	private static function gh_api_request_with_validation( string $endpoint ): array {
		$response = self::gh_api_request( $endpoint );

		// Check for WP_Error.
		if ( is_wp_error( $response ) ) {
			return [
				'success'     => false,
				'status_code' => 500,
				'message'     => $response->get_error_message(),
			];
		}

		// Get response details.
		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$headers     = wp_remote_retrieve_headers( $response );

		// Check for non-200 status codes.
		if ( 200 !== $status_code ) {
			return [
				'success'     => false,
				'status_code' => $status_code,
				'message'     => sprintf(
					/* translation: %s github response code */
					'GitHub API returned status code %d.',
					$status_code,
				),
				'body'        => $body,
				'headers'     => $headers,
			];
		}

		// Decode JSON response.
		$data = json_decode( $body, true );

		// Check for JSON decode errors.
		if ( json_last_error() !== JSON_ERROR_NONE ) {
			return [
				'success'     => false,
				'status_code' => 500,
				'message'     => __( 'Failed to parse GitHub API response as JSON.', 'oneupdate' ),
				'body'        => $body,
			];
		}

		return [
			'success'     => true,
			'status_code' => $status_code,
			'data'        => $data,
			'headers'     => $headers,
			'body'        => $body,
		];
	}

	/**
	 * Make a GitHub API request.
	 *
	 * @param string $endpoint GitHub API endpoint.
	 *
	 * @return array|\WP_Error Response array or WP_Error on failure.
	 */
	private static function gh_api_request( string $endpoint ): array|\WP_Error {
		$gh_token = Plugin_Settings::get_github_token();

		if ( empty( $gh_token ) ) {
			return new \WP_Error(
				401,
				__( 'GitHub token not configured.', 'oneupdate' ),
				[
					'success' => false,
					'message' => __( 'GitHub token not configured.', 'oneupdate' ),
				],
			);
		}

		return wp_safe_remote_get(
			$endpoint,
			[
				'headers'     => self::get_github_headers( $gh_token ),
				'httpversion' => '1.1',
				'timeout'     => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- this is to avoid timeout issues.
			],
		);
	}
}
