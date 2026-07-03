/**
 * External dependencies
 */
import '@testing-library/jest-dom';

const fetchMock = jest.fn<
	ReturnType< typeof fetch >,
	Parameters< typeof fetch >
>();

Object.defineProperty( global, 'fetch', {
	value: fetchMock,
	writable: true,
} );

Object.defineProperty( window, 'OneUpdateSettings', {
	value: {
		restUrl: 'https://example.com/wp-json',
		restNonce: 'nonce',
		api_key: 'api-key',
		siteType: 'governing-site',
	},
	writable: true,
} );

Object.defineProperty( window, 'OneUpdateOnboarding', {
	value: {
		nonce: 'onboarding-nonce',
		site_type: 'governing-site',
		setup_url: '/wp-admin/admin.php?page=oneupdate-settings',
	},
	writable: true,
} );

Object.defineProperty( window, 'OneUpdatePullRequests', {
	value: {
		restUrl: 'https://example.com/wp-json',
		restNonce: 'nonce',
		repos: [],
	},
	writable: true,
} );

Object.defineProperty( window, 'OneUpdatePlugins', {
	value: {
		restUrl: 'https://example.com/wp-json',
		restNonce: 'nonce',
	},
	writable: true,
} );

Object.defineProperty( navigator, 'clipboard', {
	value: {
		writeText: jest.fn().mockResolvedValue( undefined ),
	},
	configurable: true,
} );

/**
 * Jest test setup for OneUpdate.
 *
 * @package
 */

beforeEach( () => {
	jest.clearAllMocks();
	fetchMock.mockReset();
} );
