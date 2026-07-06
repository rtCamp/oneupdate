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
			screen.getByRole( 'heading', {
				name: 'Select Plugins to Install',
			} )
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

	it( 'shows error notice when apply-private-plugins returns failure', async () => {
		render( <S3ZipUploader /> );
		await screen.findByText( 'Custom Woo Addon' );

		// Open wizard
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Install Plugins' } )
		);

		// Select plugin
		fireEvent.click(
			screen.getByRole( 'button', { name: /Custom Woo Addon/i } )
		);

		// Next step
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Next: Select Sites' } )
		);

		// Select site
		const siteRow = await screen.findByRole( 'button', {
			name: /Shared Brand Site/i,
		} );
		fireEvent.click( siteRow );

		// Mock failure response for apply
		fetchSpy.mockImplementation( ( url ) => {
			if (
				typeof url === 'string' &&
				url.includes( 'apply-private-plugins' )
			) {
				return Promise.resolve( {
					ok: true,
					json: () =>
						Promise.resolve( {
							success: false,
							message: 'Token expired',
						} ),
				} as any );
			}
			if ( typeof url === 'string' && url.includes( 'shared-sites' ) ) {
				return Promise.resolve( {
					ok: true,
					json: () => Promise.resolve( mockSharedSitesResponse ),
				} as any );
			}
			return Promise.resolve( {
				ok: true,
				json: () => Promise.resolve( {} ),
			} as any );
		} );

		// Install
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Install Plugins' } )
		);

		// Verify error notice
		const errorNotices = await screen.findAllByText(
			/Failed to apply plugins:.*Token expired/i
		);
		expect( errorNotices.length ).toBeGreaterThanOrEqual( 1 );
	} );

	it( 'renders empty history state when no uploads exist', async () => {
		// Mock empty history
		(
			apiFetch as jest.MockedFunction< typeof apiFetch >
		 ).mockResolvedValue( [] );

		render( <S3ZipUploader /> );

		// Should still render the upload card
		expect(
			screen.getByText( /Upload Private Plugin/i )
		).toBeInTheDocument();

		// Should render empty history state
		await waitFor( () => {
			expect( screen.getByText( /No uploads yet/i ) ).toBeInTheDocument();
		} );
	} );

	it( 'shows upload error when presigned URL fetch fails', async () => {
		render( <S3ZipUploader /> );
		await screen.findByText( 'Custom Woo Addon' );

		// Select a zip file
		const fileInput = screen.getByTestId(
			'form-file-upload-input'
		) as HTMLInputElement;
		const file = new File( [ 'dummy content' ], 'bad-plugin.zip', {
			type: 'application/zip',
		} );
		fireEvent.change( fileInput, { target: { files: [ file ] } } );

		// Mock upload URL failure
		fetchSpy.mockImplementation( ( url ) => {
			if ( typeof url === 'string' && url.includes( 'upload' ) ) {
				return Promise.reject( new Error( 'Network connection lost' ) );
			}
			if ( typeof url === 'string' && url.includes( 'shared-sites' ) ) {
				return Promise.resolve( {
					ok: true,
					json: () => Promise.resolve( mockSharedSitesResponse ),
				} as any );
			}
			return Promise.resolve( {
				ok: true,
				json: () => Promise.resolve( {} ),
			} as any );
		} );

		// Click Upload button
		fireEvent.click(
			screen.getByRole( 'button', {
				name: 'Upload & Install Plugin',
			} )
		);

		// Verify site selection modal opened
		expect(
			screen.getByRole( 'heading', {
				name: 'Select Sites for Plugin Installation',
			} )
		).toBeInTheDocument();

		// Select site
		const siteRow = screen.getByRole( 'button', {
			name: /Shared Brand Site/i,
		} );
		fireEvent.click( siteRow );

		// Confirm upload
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Install Plugin' } )
		);

		// Verify error notice
		const errorNotices = await screen.findAllByText(
			/Upload failed:.*Network connection lost/i
		);
		expect( errorNotices.length ).toBeGreaterThanOrEqual( 1 );
		// Click notice dismiss button to cover onRemove
		const dismissBtn = document.querySelector(
			'.components-notice__dismiss'
		);
		expect( dismissBtn ).toBeInTheDocument();
		fireEvent.click( dismissBtn! );

		// Verify notice is gone
		expect(
			document.querySelector( '.components-notice' )
		).not.toBeInTheDocument();
	} );

	it( 'copies URL and shows Copied feedback on Copy URL button click', async () => {
		render( <S3ZipUploader /> );
		await screen.findByText( 'Custom Woo Addon' );

		// Click Copy URL button
		const copyBtn = screen.getByRole( 'button', { name: 'Copy URL' } );
		fireEvent.click( copyBtn );

		// Verify clipboard was called
		expect( navigator.clipboard.writeText ).toHaveBeenCalledWith(
			'https://s3.amazonaws.com/bucket/custom-woo-addon.2.1.0.zip'
		);

		// Verify button text changed to Copied
		expect(
			screen.getByRole( 'button', { name: 'Copied URL' } )
		).toBeInTheDocument();
	} );

	it( 'shows selected file name after choosing a zip file', async () => {
		render( <S3ZipUploader /> );
		await screen.findByText( 'Custom Woo Addon' );

		// Select a zip file
		const fileInput = screen.getByTestId(
			'form-file-upload-input'
		) as HTMLInputElement;
		const file = new File( [ 'dummy' ], 'my-plugin.zip', {
			type: 'application/zip',
		} );
		fireEvent.change( fileInput, { target: { files: [ file ] } } );

		// Verify file name is displayed
		expect(
			screen.getByText( /Selected file:.*my-plugin\.zip/i )
		).toBeInTheDocument();

		// Verify Upload button is now enabled
		const uploadBtn = screen.getByRole( 'button', {
			name: 'Upload & Install Plugin',
		} );
		expect( uploadBtn ).not.toBeDisabled();
	} );

	it( 'supports keyboard accessibility and bulk selection in the apply wizard modal', async () => {
		render( <S3ZipUploader /> );
		await screen.findByText( 'Custom Woo Addon' );

		// Open apply plugins wizard modal
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Install Plugins' } )
		);

		// Step 1: Plugin Selection Modal
		expect(
			screen.getByRole( 'heading', {
				name: 'Select Plugins to Install',
			} )
		).toBeInTheDocument();

		// Find the plugin row button (Custom Woo Addon)
		const pluginButton = screen.getByRole( 'button', {
			name: /Custom Woo Addon/i,
		} );

		// Press key 'Enter' on the plugin row button
		fireEvent.keyDown( pluginButton, { key: 'Enter', code: 'Enter' } );

		// Verify it got selected (Clear Selection button becomes enabled)
		const clearBtn = screen.getByRole( 'button', {
			name: 'Clear Selection',
		} );
		expect( clearBtn ).not.toBeDisabled();

		// Click Clear Selection
		fireEvent.click( clearBtn );
		expect( clearBtn ).toBeDisabled();

		// Toggle select all plugins checkbox
		const selectAllCheckbox = screen.getByLabelText( 'Select All Plugins' );
		fireEvent.click( selectAllCheckbox );
		expect( clearBtn ).not.toBeDisabled();

		// Click Next: Select Sites
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Next: Select Sites' } )
		);

		// Step 2: Site Selection Modal
		expect(
			screen.getByRole( 'heading', {
				name: 'Select Sites for Installation',
			} )
		).toBeInTheDocument();

		// Find site row
		const siteRow = await screen.findByRole( 'button', {
			name: /Shared Brand Site/i,
		} );

		// Press key 'Enter' on the site row button
		fireEvent.keyDown( siteRow, { key: 'Enter', code: 'Enter' } );

		// Verify Install Plugins button is enabled (since site is selected)
		const installBtn = screen.getByRole( 'button', {
			name: 'Install Plugins',
		} );
		expect( installBtn ).not.toBeDisabled();
	} );
} );
