<?php
/**
 * Handles REST API behavior.
 *
 * @package OneUpdate\Modules\Rest
 */

declare( strict_types = 1 );

namespace OneUpdate\Modules\Core;

use OneUpdate\Contracts\Interfaces\Registrable;

/**
 * Class REST
 */
final class Rest implements Registrable {

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		add_filter( 'rest_allowed_cors_headers', [ $this, 'allowed_cors_headers' ] );
	}

	/**
	 * Adds plugin CORS headers to those allowed in REST responses.
	 *
	 * @param array<int, string> $headers Existing headers.
	 *
	 * @return array<int, string> Modified headers.
	 */
	public function allowed_cors_headers( $headers ): array {
		// Skip if the headers are already present.
		if ( in_array( 'X-OneUpdate-Token', $headers, true ) ) {
			return $headers;
		}

		return array_merge(
			$headers,
			[
				'X-OneUpdate-Token',
			]
		);
	}
}
