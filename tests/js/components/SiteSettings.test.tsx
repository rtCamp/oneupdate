/**
 * External dependencies
 */
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';

/**
 * Internal dependencies
 */
import SiteSettings from '@/components/SiteSettings';

describe( 'SiteSettings', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	const setupFetchMock = ( {
		secretKey = 'my-api-key',
		governingSiteUrl = 'https://governing.com',
		deleteSuccess = true,
		postSecretKey = 'new-api-key',
	} = {} ) => {
		global.fetch = jest
			.fn()
			.mockImplementation( ( url: string, options?: RequestInit ) => {
				if ( url.includes( '/secret-key' ) ) {
					if ( options?.method === 'POST' ) {
						return Promise.resolve( {
							ok: true,
							json: () =>
								Promise.resolve( {
									secret_key: postSecretKey,
								} ),
						} );
					}
					return Promise.resolve( {
						ok: true,
						json: () =>
							Promise.resolve( { secret_key: secretKey } ),
					} );
				}
				if ( url.includes( '/governing-site' ) ) {
					if ( options?.method === 'DELETE' ) {
						return Promise.resolve( {
							ok: deleteSuccess,
							json: () =>
								Promise.resolve( { success: deleteSuccess } ),
						} );
					}
					return Promise.resolve( {
						ok: true,
						json: () =>
							Promise.resolve( {
								governing_site_url: governingSiteUrl,
							} ),
					} );
				}
				return Promise.reject(
					new Error( `Unhandled mock URL: ${ url }` )
				);
			} ) as typeof fetch;
	};

	it( 'renders loading spinner initially, then displays settings on mount', async () => {
		setupFetchMock();

		render( <SiteSettings /> );

		// Wait for data load (buttons render after loading is false)
		await screen.findByRole( 'button', { name: /Copy API Key/i } );

		const apiKeyInput = document.querySelector( 'textarea' );
		expect( apiKeyInput ).toHaveValue( 'my-api-key' );
		expect( screen.getByLabelText( /Governing Site URL/i ) ).toHaveValue(
			'https://governing.com'
		);
	} );

	it( 'copies API key to clipboard', async () => {
		const writeTextMock = jest.fn().mockResolvedValue( undefined );
		Object.defineProperty( navigator, 'clipboard', {
			value: { writeText: writeTextMock },
			configurable: true,
			writable: true,
		} );

		setupFetchMock( { secretKey: 'my-api-key', governingSiteUrl: '' } );

		render( <SiteSettings /> );

		const copyButton = await screen.findByRole( 'button', {
			name: /Copy API Key/i,
		} );
		fireEvent.click( copyButton );

		await waitFor( () => {
			expect( writeTextMock ).toHaveBeenCalledWith( 'my-api-key' );
		} );

		// Verify success notice is displayed
		await waitFor( () => {
			const noticeEl = document.querySelector(
				'.components-notice__content'
			);
			expect( noticeEl ).toBeInTheDocument();
			expect( noticeEl?.textContent ).toContain(
				'API key copied to clipboard.'
			);
		} );
	} );

	it( 'regenerates API Key on button click', async () => {
		setupFetchMock( {
			secretKey: 'old-api-key',
			postSecretKey: 'new-api-key',
			governingSiteUrl: '',
		} );

		render( <SiteSettings /> );

		// Wait for data load
		await screen.findByRole( 'button', { name: /Copy API Key/i } );

		const apiKeyInput = document.querySelector( 'textarea' );
		expect( apiKeyInput ).toHaveValue( 'old-api-key' );

		const regenerateButton = screen.getByRole( 'button', {
			name: /Regenerate API Key/i,
		} );
		fireEvent.click( regenerateButton );

		await waitFor( () => {
			expect( global.fetch ).toHaveBeenLastCalledWith(
				expect.stringContaining( '/oneupdate/v1/secret-key' ),
				expect.objectContaining( { method: 'POST' } )
			);
		} );

		await waitFor( () => {
			expect( apiKeyInput ).toHaveValue( 'new-api-key' );
		} );

		await waitFor( () => {
			const noticeEl = document.querySelector(
				'.components-notice__content'
			);
			expect( noticeEl ).toBeInTheDocument();
			expect( noticeEl?.textContent ).toContain(
				'API key regenerated successfully.'
			);
		} );
	} );

	it( 'shows disconnect governing site confirmation modal and deletes connection', async () => {
		setupFetchMock( {
			secretKey: 'my-api-key',
			governingSiteUrl: 'https://governing.com',
			deleteSuccess: true,
		} );

		render( <SiteSettings /> );

		const disconnectButton = await screen.findByRole( 'button', {
			name: /Disconnect Governing Site/i,
		} );
		fireEvent.click( disconnectButton );

		// Confirm dialog is shown
		const dialog = screen.getByRole( 'dialog', {
			name: 'Disconnect Governing Site',
		} );
		expect(
			within( dialog ).getByText(
				/Are you sure you want to disconnect from the governing site?/i
			)
		).toBeInTheDocument();

		// Click confirm Disconnect button inside dialog
		const confirmDisconnect = within( dialog ).getByRole( 'button', {
			name: /^Disconnect$/i,
		} );
		fireEvent.click( confirmDisconnect );

		await waitFor( () => {
			expect( global.fetch ).toHaveBeenLastCalledWith(
				expect.stringContaining( '/oneupdate/v1/governing-site' ),
				expect.objectContaining( { method: 'DELETE' } )
			);
		} );

		// Verify notice and inputs updated
		await waitFor( () => {
			const noticeEl = document.querySelector(
				'.components-notice__content'
			);
			expect( noticeEl ).toBeInTheDocument();
			expect( noticeEl?.textContent ).toContain(
				'Governing site disconnected successfully.'
			);
		} );

		// Check that the input has been cleared
		expect( screen.getByLabelText( /Governing Site URL/i ) ).toHaveValue(
			''
		);
	} );
} );
