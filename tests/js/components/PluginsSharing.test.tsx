/**
 * External dependencies
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Initialize global object required by the component
beforeAll( () => {
	( window as any ).OneUpdatePlugins = {
		restUrl: 'https://example.com/wp-json',
		restNonce: 'nonce',
		api_key: 'test-api-key',
	};
} );

import PluginsSharing from '@/components/PluginsSharing';

describe( 'PluginsSharing', () => {
	const mockPluginsResponse = {
		plugins: [
			{
				name: 'SEO Plugin',
				slug: 'seo-plugin',
				version: '3.4.1',
				short_description: 'Improve your search rankings.',
				icons: {
					'1x': 'https://example.com/seo.png',
				},
				versions: {
					'3.4.1': 'zip-url',
				},
				author: 'SEO Team',
			},
		],
		info: {
			page: 1,
			pages: 1,
		},
	};

	const mockSharedSitesResponse = {
		shared_sites: [
			{
				id: 'site-1',
				name: 'Governed Site',
				url: 'https://governed.example.com/',
			},
		],
	};

	let fetchSpy: jest.SpyInstance;

	beforeEach( () => {
		fetchSpy = jest
			.spyOn( global, 'fetch' )
			.mockImplementation( ( url ) => {
				if (
					typeof url === 'string' &&
					url.includes( 'api.wordpress.org' )
				) {
					return Promise.resolve( {
						ok: true,
						json: () => Promise.resolve( mockPluginsResponse ),
					} as any );
				}
				if (
					typeof url === 'string' &&
					url.includes( 'shared-sites' )
				) {
					return Promise.resolve( {
						ok: true,
						json: () => Promise.resolve( mockSharedSitesResponse ),
					} as any );
				}
				if (
					typeof url === 'string' &&
					url.includes( 'apply-plugins' )
				) {
					return Promise.resolve( {
						ok: true,
						json: () =>
							Promise.resolve( {
								success: true,
								created_prs: [
									{
										name: 'Governed Site',
										run_url:
											'https://github.com/org/repo/pull/1',
									},
								],
							} ),
					} as any );
				}
				return Promise.reject(
					new Error( `Unhandled mock URL: ${ url }` )
				);
			} );
	} );

	afterEach( () => {
		fetchSpy.mockRestore();
	} );

	it( 'renders search tip guidance initially and does not fetch plugins on mount', async () => {
		render( <PluginsSharing /> );

		// Tip text should be visible
		expect(
			screen.getByText( /Tip: Try searching for specific functionality/i )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Search Plugins' } )
		).toBeInTheDocument();

		// Should NOT load plugins initially
		expect( screen.queryByText( 'SEO Plugin' ) ).not.toBeInTheDocument();

		// But shared sites data IS loaded on mount
		expect( fetchSpy ).toHaveBeenCalledWith(
			expect.stringContaining( 'shared-sites' ),
			expect.any( Object )
		);
	} );

	it( 'searches and installs selected plugins on brand sites', async () => {
		render( <PluginsSharing /> );

		// Search for plugin
		const searchInput =
			screen.getByPlaceholderText( /Search for plugins/i );
		fireEvent.change( searchInput, { target: { value: 'seo' } } );

		const searchButton = screen.getByRole( 'button', {
			name: 'Search Plugins',
		} );
		fireEvent.click( searchButton );

		// Should show search loading
		expect( screen.getByText( 'Searching plugins…' ) ).toBeInTheDocument();

		// Wait for search result cards to render
		await waitFor( () => {
			expect(
				screen.getByRole( 'heading', { name: 'SEO Plugin' } )
			).toBeInTheDocument();
		} );
		expect(
			screen.queryByText( 'Searching plugins…' )
		).not.toBeInTheDocument();

		// Select the plugin
		const selectButton = screen.getByRole( 'button', {
			name: 'Select Plugin',
		} );
		fireEvent.click( selectButton );

		// Verify apply button shows with selection count
		expect(
			screen.getByText( /1\s+plugin\s+selected/i )
		).toBeInTheDocument();
		const applyBtn = screen.getByRole( 'button', {
			name: 'Install Selected Plugins',
		} );
		fireEvent.click( applyBtn );

		// Modal should open
		expect(
			screen.getByRole( 'heading', { name: 'Install Selected Plugins' } )
		).toBeInTheDocument();

		// Select site row
		const siteRow = screen.getByRole( 'button', {
			name: /Governed Site/i,
		} );
		fireEvent.click( siteRow );

		// Click Install Plugins button
		const installButton = screen.getByRole( 'button', {
			name: 'Install Plugins',
		} );
		fireEvent.click( installButton );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenLastCalledWith(
				expect.stringContaining( 'apply-plugins' ),
				expect.objectContaining( {
					method: 'POST',
					body: JSON.stringify( {
						sites: [
							{
								id: 'site-1',
								name: 'Governed Site',
								url: 'https://governed.example.com/',
							},
						],
						plugins: [
							{
								slug: 'seo-plugin',
								version: '3.4.1',
							},
						],
						plugin_type: 'add_update',
					} ),
				} )
			);
		} );

		// Verify success notice is displayed
		const successNotice = await screen.findAllByText(
			/Plugins applied successfully.*Governed Site.*https:\/\/github.com\/org\/repo\/pull\/1/i
		);
		expect( successNotice.length ).toBeGreaterThanOrEqual( 1 );
	} );

	it( 'handles search error state and supports retrying search', async () => {
		render( <PluginsSharing /> );

		// Search for plugin
		const searchInput =
			screen.getByPlaceholderText( /Search for plugins/i );
		fireEvent.change( searchInput, { target: { value: 'error-query' } } );

		const searchButton = screen.getByRole( 'button', {
			name: 'Search Plugins',
		} );

		// Mock error response for plugin search
		fetchSpy.mockImplementationOnce( ( url ) => {
			if (
				typeof url === 'string' &&
				url.includes( 'api.wordpress.org' )
			) {
				return Promise.resolve( {
					ok: false,
				} as any );
			}
			return Promise.resolve( {
				ok: true,
				json: () => Promise.resolve( mockSharedSitesResponse ),
			} as any );
		} );

		fireEvent.click( searchButton );

		// Wait for error container
		const errorTitle = await screen.findByText( 'Unable to load plugins' );
		expect( errorTitle ).toBeInTheDocument();

		const tryAgainButton = screen.getByRole( 'button', {
			name: 'Try Again',
		} );
		fireEvent.click( tryAgainButton );

		// Wait for search result cards to render on successful retry
		await waitFor( () => {
			expect(
				screen.getByRole( 'heading', { name: 'SEO Plugin' } )
			).toBeInTheDocument();
		} );
	} );
} );
