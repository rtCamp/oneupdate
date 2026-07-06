/**
 * External dependencies
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Internal dependencies
 */
import S3Credentials from '@/components/S3Credentials';

describe( 'S3Credentials', () => {
	const setNoticeMock = jest.fn();

	beforeEach( () => {
		jest.clearAllMocks();
	} );

	it( 'renders loading state and then credentials on mount', async () => {
		global.fetch = jest.fn().mockResolvedValue( {
			ok: true,
			json: () =>
				Promise.resolve( {
					s3_credentials: {
						accessKey: 'my-access-key',
						secretKey: 'my-secret-key',
						bucketName: 'my-bucket',
						region: 'us-east-1',
						endpoint: 'https://s3.amazonaws.com',
					},
				} ),
		} ) as typeof fetch;

		render( <S3Credentials setNotice={ setNoticeMock } /> );

		// Verify initial loading message
		expect( screen.getByText( /Loading…/i ) ).toBeInTheDocument();

		// Wait for credentials to load and verify values are set
		const bucketInput = await screen.findByLabelText( /Bucket Name/i );
		expect( bucketInput ).toHaveValue( 'my-bucket' );
		expect( screen.getByLabelText( /Region/i ) ).toHaveValue( 'us-east-1' );
		expect( screen.getByLabelText( /Endpoint/i ) ).toHaveValue(
			'https://s3.amazonaws.com'
		);
		expect( screen.getByLabelText( /Access Key/i ) ).toHaveValue(
			'my-access-key'
		);
		expect( screen.getByLabelText( /Secret Key/i ) ).toHaveValue(
			'my-secret-key'
		);
	} );

	it( 'validates required fields before submitting', async () => {
		global.fetch = jest.fn().mockResolvedValue( {
			ok: true,
			json: () => Promise.resolve( {} ),
		} ) as typeof fetch;

		render( <S3Credentials setNotice={ setNoticeMock } /> );

		const bucketInput = await screen.findByLabelText( /Bucket Name/i );
		fireEvent.change( bucketInput, { target: { value: 'my-bucket' } } );

		const saveButton = screen.getByRole( 'button', {
			name: /Save Credentials/i,
		} );
		fireEvent.click( saveButton );

		await waitFor( () => {
			expect( setNoticeMock ).toHaveBeenCalledWith( {
				type: 'error',
				message: 'All fields are required to save S3 credentials.',
			} );
		} );
	} );

	it( 'validates endpoint URL structure before submitting', async () => {
		global.fetch = jest.fn().mockResolvedValue( {
			ok: true,
			json: () => Promise.resolve( {} ),
		} ) as typeof fetch;

		render( <S3Credentials setNotice={ setNoticeMock } /> );

		const bucketInput = await screen.findByLabelText( /Bucket Name/i );
		fireEvent.change( bucketInput, { target: { value: 'my-bucket' } } );
		fireEvent.change( screen.getByLabelText( /Region/i ), {
			target: { value: 'us-east-1' },
		} );
		fireEvent.change( screen.getByLabelText( /Endpoint/i ), {
			target: { value: 'not-a-valid-url' },
		} );
		fireEvent.change( screen.getByLabelText( /Access Key/i ), {
			target: { value: 'my-access-key' },
		} );
		fireEvent.change( screen.getByLabelText( /Secret Key/i ), {
			target: { value: 'my-secret-key' },
		} );

		const saveButton = screen.getByRole( 'button', {
			name: /Save Credentials/i,
		} );
		fireEvent.click( saveButton );

		await waitFor( () => {
			expect( setNoticeMock ).toHaveBeenCalledWith( {
				type: 'error',
				message: 'Please enter a valid URL for the S3 endpoint.',
			} );
		} );
	} );

	it( 'saves credentials successfully', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce( {
				ok: true,
				json: () => Promise.resolve( {} ),
			} )
			.mockResolvedValueOnce( {
				ok: true,
				json: () => Promise.resolve( { success: true } ),
			} ) as typeof fetch;

		render( <S3Credentials setNotice={ setNoticeMock } /> );

		const bucketInput = await screen.findByLabelText( /Bucket Name/i );
		fireEvent.change( bucketInput, { target: { value: 'my-bucket' } } );
		fireEvent.change( screen.getByLabelText( /Region/i ), {
			target: { value: 'us-east-1' },
		} );
		fireEvent.change( screen.getByLabelText( /Endpoint/i ), {
			target: { value: 'https://s3.example.com' },
		} );
		fireEvent.change( screen.getByLabelText( /Access Key/i ), {
			target: { value: 'my-access-key' },
		} );
		fireEvent.change( screen.getByLabelText( /Secret Key/i ), {
			target: { value: 'my-secret-key' },
		} );

		const saveButton = screen.getByRole( 'button', {
			name: /Save Credentials/i,
		} );
		fireEvent.click( saveButton );

		await waitFor( () => {
			expect( global.fetch ).toHaveBeenLastCalledWith(
				expect.stringContaining( '/oneupdate/v1/s3-credentials' ),
				expect.objectContaining( {
					method: 'POST',
					body: JSON.stringify( {
						s3_credentials: {
							accessKey: 'my-access-key',
							secretKey: 'my-secret-key',
							bucketName: 'my-bucket',
							region: 'us-east-1',
							endpoint: 'https://s3.example.com',
						},
					} ),
				} )
			);
		} );

		await waitFor( () => {
			expect( setNoticeMock ).toHaveBeenCalledWith( {
				type: 'success',
				message: 'S3 credentials saved successfully.',
			} );
		} );
	} );

	it( 'shows error notice when S3 credentials save fails', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce( {
				ok: true,
				json: () => Promise.resolve( {} ),
			} )
			.mockResolvedValueOnce( {
				ok: false,
				json: () => Promise.resolve( {} ),
			} ) as typeof fetch;

		render( <S3Credentials setNotice={ setNoticeMock } /> );

		const bucketInput = await screen.findByLabelText( /Bucket Name/i );
		fireEvent.change( bucketInput, { target: { value: 'my-bucket' } } );
		fireEvent.change( screen.getByLabelText( /Region/i ), {
			target: { value: 'us-east-1' },
		} );
		fireEvent.change( screen.getByLabelText( /Endpoint/i ), {
			target: { value: 'https://s3.example.com' },
		} );
		fireEvent.change( screen.getByLabelText( /Access Key/i ), {
			target: { value: 'my-access-key' },
		} );
		fireEvent.change( screen.getByLabelText( /Secret Key/i ), {
			target: { value: 'my-secret-key' },
		} );

		const saveButton = screen.getByRole( 'button', {
			name: /Save Credentials/i,
		} );
		fireEvent.click( saveButton );

		await waitFor( () => {
			expect( setNoticeMock ).toHaveBeenCalledWith( {
				type: 'error',
				message:
					'Failed to save S3 credentials. Please try again later.',
			} );
		} );
	} );
} );
