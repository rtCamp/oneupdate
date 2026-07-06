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

// Mock apiFetch for loading upload history
jest.mock( '@wordpress/api-fetch', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

import S3ZipUploader from '@/components/S3ZipUploader';

describe( 'S3ZipUploader', () => {
	const mockHistoryData = [
		{
			file_name: 'Custom Woo Addon',
			version: '2.1.0',
			upload_time: new Date().toISOString(),
			status: 'applied',
			presigned_url:
				'https://s3.amazonaws.com/bucket/custom-woo-addon.2.1.0.zip',
		},
	];

	const mockSharedSitesResponse = {
		shared_sites: [
			{
				id: 'site-a',
				name: 'Shared Brand Site',
				url: 'https://brand.example.com/',
			},
		],
	};

	let fetchSpy: jest.SpyInstance;

	beforeEach( () => {
		( apiFetch as jest.MockedFunction< typeof apiFetch > ).mockReset();
		(
			apiFetch as jest.MockedFunction< typeof apiFetch >
		 ).mockResolvedValue( mockHistoryData );

		fetchSpy = jest
			.spyOn( global, 'fetch' )
			.mockImplementation( ( url ) => {
				if (
					typeof url === 'string' &&
					url.includes( 'shared-sites' )
				) {
					return Promise.resolve( {
						ok: true,
						json: () => Promise.resolve( mockSharedSitesResponse ),
					} as any );
				}
				if ( typeof url === 'string' && url.includes( 'upload' ) ) {
					return Promise.resolve( {
						ok: true,
						json: () =>
							Promise.resolve( {
								presigned_url:
									'https://s3.amazonaws.com/bucket/uploaded.zip',
							} ),
					} as any );
				}
				if (
					typeof url === 'string' &&
					url.includes( 'apply-private-plugins' )
				) {
					return Promise.resolve( {
						ok: true,
						json: () =>
							Promise.resolve( {
								success: true,
								results: [
									{
										name: 'Shared Brand Site',
										run_url:
											'https://github.com/org/repo/actions/runs/12345',
									},
								],
							} ),
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
								results: [
									{
										name: 'Shared Brand Site',
										run_url:
											'https://github.com/org/repo/actions/runs/54321',
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

	it( 'renders S3ZipUploader upload box and history table on mount', async () => {
		render( <S3ZipUploader /> );

		// Check drop zone area renders
		expect(
			screen.getByText( /Upload Private Plugin/i )
		).toBeInTheDocument();
		expect(
			screen.getByText( /Choose plugin zip file/i )
		).toBeInTheDocument();

		// Wait for history table to load from apiFetch
		await waitFor( () => {
			expect(
				screen.getByText( 'Custom Woo Addon' )
			).toBeInTheDocument();
		} );

		expect(
			screen.getByRole( 'button', { name: 'Copy URL' } )
		).toBeInTheDocument();
	} );

	it( 'handles S3 upload and apply workflow on selected file', async () => {
		render( <S3ZipUploader /> );

		// Wait for history table load
		await screen.findByText( 'Custom Woo Addon' );

		// Select a zip file
		const fileInput = screen.getByTestId(
			'form-file-upload-input'
		) as HTMLInputElement;
		const file = new File( [ 'dummy content' ], 'test-plugin.zip', {
			type: 'application/zip',
		} );
		fireEvent.change( fileInput, { target: { files: [ file ] } } );

		// Click Upload button to trigger site selection modal
		const uploadBtn = screen.getByRole( 'button', {
			name: 'Upload & Install Plugin',
		} );
		fireEvent.click( uploadBtn );

		// Verify site selection modal opened
		expect(
			screen.getByRole( 'heading', {
				name: 'Select Sites for Plugin Installation',
			} )
		).toBeInTheDocument();

		// Select Brand Site row
		const siteRow = screen.getByRole( 'button', {
			name: /Shared Brand Site/i,
		} );
		fireEvent.click( siteRow );

		// Confirm upload
		const confirmBtn = screen.getByRole( 'button', {
			name: 'Install Plugin',
		} );
		fireEvent.click( confirmBtn );

		// Wait for upload fetch requests to run
		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenCalledWith(
				expect.stringContaining( 'upload' ),
				expect.any( Object )
			);
		} );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenLastCalledWith(
				expect.stringContaining( 'apply-private-plugins' ),
				expect.objectContaining( {
					method: 'POST',
					body: expect.stringContaining( 'uploaded.zip' ),
				} )
			);
		} );

		// Check success notification
		const successNotice = await screen.findAllByText(
			/Plugin uploaded and applied successfully.*Shared Brand Site.*https:\/\/github.com\/org\/repo\/actions\/runs\/12345/i
		);
		expect( successNotice.length ).toBeGreaterThanOrEqual( 1 );
	} );

	it( 'supports applying existing plugins in history via the modal wizard flow', async () => {
		render( <S3ZipUploader /> );

		// Wait for history load
		await screen.findByText( 'Custom Woo Addon' );

		// Click Apply Plugins wizard launcher button
		const wizardLauncher = screen.getByRole( 'button', {
			name: 'Install Plugins',
		} );
		fireEvent.click( wizardLauncher );

		// Step 1: Plugin Selection Modal
		expect(
			screen.getByRole( 'heading', { name: 'Select Plugins to Install' } )
		).toBeInTheDocument();

		// Select the plugin wrapper button in history list
		const pluginButton = screen.getByRole( 'button', {
			name: /Custom Woo Addon/i,
		} );
		fireEvent.click( pluginButton );

		// Next Step
		const nextBtn = screen.getByRole( 'button', {
			name: 'Next: Select Sites',
		} );
		fireEvent.click( nextBtn );

		// Step 2: Site Selection Modal
		expect(
			screen.getByRole( 'heading', {
				name: 'Select Sites for Installation',
			} )
		).toBeInTheDocument();

		// Select site row
		const siteRow = await screen.findByRole( 'button', {
			name: /Shared Brand Site/i,
		} );
		fireEvent.click( siteRow );

		// Click Install Plugins to trigger installation POST request
		const installBtn = screen.getByRole( 'button', {
			name: 'Install Plugins',
		} );
		fireEvent.click( installBtn );

		await waitFor( () => {
			expect( fetchSpy ).toHaveBeenCalledWith(
				expect.stringContaining( 'apply-private-plugins' ),
				expect.objectContaining( {
					method: 'POST',
					body: expect.stringContaining(
						'custom-woo-addon.2.1.0.zip'
					),
				} )
			);
		} );

		// Verify success notice in parent app
		const successNotice = await screen.findAllByText(
			/Plugins applied successfully.*Shared Brand Site.*https:\/\/github.com\/org\/repo\/actions\/runs\/12345/i
		);
		expect( successNotice.length ).toBeGreaterThanOrEqual( 1 );
	} );
} );
