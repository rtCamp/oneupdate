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

// Mock PluginCard to isolate grid integration tests
jest.mock( '@/components/PluginCard', () => ( {
	__esModule: true,
	default: ( {
		plugin,
		selectedPlugin,
		onSelect,
		onVersionChange,
	}: {
		plugin: any;
		selectedPlugin: Array< any >;
		onSelect: ( slug: string, version: string | null ) => void;
		onVersionChange: ( slug: string, version: string ) => void;
	} ) => {
		const isSelected = selectedPlugin.some(
			( p ) => p.slug === plugin.slug
		);
		return (
			<div data-testid={ `plugin-card-${ plugin.slug }` }>
				<span>{ plugin.name }</span>
				<span>{ isSelected ? 'Selected' : 'Not Selected' }</span>
				<button
					type="button"
					onClick={ () =>
						onSelect(
							plugin.slug,
							isSelected ? null : plugin.version
						)
					}
				>
					Toggle Select
				</button>
				<button
					type="button"
					onClick={ () => onVersionChange( plugin.slug, '1.1.0' ) }
				>
					Change Version
				</button>
			</div>
		);
	},
} ) );

import PluginGrid from '@/components/PluginGrid';

describe( 'PluginGrid', () => {
	const mockPluginsResponse = {
		plugins: [
			{
				name: 'Plugin A',
				slug: 'plugin-a',
				version: '1.2.0',
			},
			{
				name: 'Plugin B',
				slug: 'plugin-b',
				version: '2.0.0',
			},
		],
		info: {
			page: 1,
			pages: 3,
		},
	};

	const mockSharedSitesResponse = {
		shared_sites: [
			{
				id: 'site-1',
				name: 'Brand Site One',
				url: 'https://brand1.example.com/',
			},
			{
				id: 'site-2',
				name: 'Brand Site Two',
				url: 'https://brand2.example.com/',
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
										data: {
											pr_url: 'https://github.com/org/repo/pull/1',
										},
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

	it( 'loads plugins and shared sites on mount', async () => {
		render( <PluginGrid /> );

		// Should show loading spinner initially
		expect( screen.getByText( 'Loading plugins…' ) ).toBeInTheDocument();

		// Wait for plugins to render
		await waitFor( () => {
			expect(
				screen.getByTestId( 'plugin-card-plugin-a' )
			).toBeInTheDocument();
		} );

		expect(
			screen.getByTestId( 'plugin-card-plugin-b' )
		).toBeInTheDocument();
		expect(
			screen.queryByText( 'Loading plugins…' )
		).not.toBeInTheDocument();

		// Check fetch calls
		expect( fetchSpy ).toHaveBeenCalledWith(
			expect.stringContaining( 'query_plugins' )
		);
		expect( fetchSpy ).toHaveBeenCalledWith(
			expect.stringContaining( 'shared-sites' ),
			expect.any( Object )
		);
	} );

	it( 'updates listings on search submission', async () => {
		render( <PluginGrid /> );

		await waitFor( () => {
			expect(
				screen.getByTestId( 'plugin-card-plugin-a' )
			).toBeInTheDocument();
		} );

		const searchInput = screen.getByPlaceholderText( /Search plugins/i );
		fireEvent.change( searchInput, { target: { value: 'custom-query' } } );

		const searchButton = screen.getByRole( 'button', { name: 'Search' } );
		fireEvent.click( searchButton );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenLastCalledWith(
				expect.stringContaining( 'search=custom-query' )
			);
		} );
	} );

	it( 'paginates plugin lists correctly', async () => {
		render( <PluginGrid /> );

		await waitFor( () => {
			expect(
				screen.getByTestId( 'plugin-card-plugin-a' )
			).toBeInTheDocument();
		} );

		const nextButton = screen.getByRole( 'button', { name: 'Next' } );
		fireEvent.click( nextButton );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenLastCalledWith(
				expect.stringContaining( 'page=2' )
			);
		} );

		// Wait for loading to finish and page 2 plugins to render
		await screen.findByTestId( 'plugin-card-plugin-a' );

		const prevButton = screen.getByRole( 'button', { name: 'Previous' } );
		fireEvent.click( prevButton );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenLastCalledWith(
				expect.stringContaining( 'page=1' )
			);
		} );
	} );

	it( 'displays error notice when fetching plugins fails', async () => {
		fetchSpy.mockImplementationOnce( () =>
			Promise.resolve( {
				ok: false,
			} as any )
		);

		render( <PluginGrid /> );

		const errorNotice = await screen.findByText(
			'Failed to fetch plugins.'
		);
		expect( errorNotice ).toBeInTheDocument();

		const retryButton = screen.getByRole( 'button', { name: 'Try Again' } );
		fireEvent.click( retryButton );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenCalledTimes( 3 ); // 1 (fail) + 1 (shared sites) + 1 (retry)
		} );
	} );

	it( 'manages plugin selections and applies them to selected sites', async () => {
		render( <PluginGrid /> );

		await waitFor( () => {
			expect(
				screen.getByTestId( 'plugin-card-plugin-a' )
			).toBeInTheDocument();
		} );

		// Toggle select plugin-a
		const toggleButton = screen.getAllByRole( 'button', {
			name: 'Toggle Select',
		} )[ 0 ];
		fireEvent.click( toggleButton as HTMLElement );

		// Confirm active selected count shows 1 plugin
		expect(
			screen.getByText( /1\s+plugin\s+selected/i )
		).toBeInTheDocument();
		const applyButton = screen.getByRole( 'button', {
			name: 'Apply selected plugins',
		} );
		expect( applyButton ).toBeInTheDocument();

		// Change version of plugin-a
		const changeVersionBtn = screen.getAllByRole( 'button', {
			name: 'Change Version',
		} )[ 0 ];
		fireEvent.click( changeVersionBtn as HTMLElement );

		// Click Apply to open modal
		fireEvent.click( applyButton );

		// Verify apply modal opened
		expect(
			screen.getByRole( 'heading', { name: 'Apply Selected Plugins' } )
		).toBeInTheDocument();

		// Checkbox for Brand Site One
		const siteOneCheckbox = screen.getByLabelText( 'Brand Site One' );
		fireEvent.click( siteOneCheckbox );

		// Click Apply in confirmation modal
		const confirmApplyButton = screen.getByRole( 'button', {
			name: 'Apply Plugins',
		} );
		fireEvent.click( confirmApplyButton );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenLastCalledWith(
				expect.stringContaining( 'apply-plugins' ),
				expect.objectContaining( {
					method: 'POST',
					body: JSON.stringify( {
						sites: [
							{
								id: 'site-1',
								name: 'Brand Site One',
								url: 'https://brand1.example.com/',
							},
						],
						plugins: [
							{
								slug: 'plugin-a',
								version: '1.1.0',
							},
						],
					} ),
				} )
			);
		} );

		// Verify success notice is displayed
		const successNotice = await screen.findAllByText(
			/Plugins applied successfully. Please check the PR at: https:\/\/github.com\/org\/repo\/pull\/1/i
		);
		expect( successNotice.length ).toBeGreaterThanOrEqual( 1 );
	} );
} );
