/**
 * External dependencies
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

import OnboardingScreen from '@/admin/onboarding/page';

const mockedApiFetch = apiFetch as jest.MockedFunction< typeof apiFetch >;

describe( 'OnboardingScreen', () => {
	beforeEach( () => {
		mockedApiFetch.mockReset();
		window.OneUpdateOnboarding = {
			nonce: 'onboarding-nonce',
			site_type: '',
			setup_url: '/wp-admin/admin.php?page=oneupdate-settings',
		};
	} );

	it( 'loads the current site type from settings', async () => {
		mockedApiFetch.mockResolvedValueOnce( {
			oneupdate_site_type: 'brand-site',
		} );

		render( <OnboardingScreen /> );

		await waitFor( () => {
			expect( screen.getByLabelText( 'Site Type' ) ).toHaveValue(
				'brand-site'
			);
		} );
	} );

	it( 'shows an error notice when loading fails', async () => {
		mockedApiFetch.mockRejectedValueOnce( new Error( 'load failed' ) );

		render( <OnboardingScreen /> );

		// WordPress renders notices in both accessibility region and visible content
		expect(
			await screen.findAllByText( 'Error fetching site type.' )
		).toHaveLength( 2 );
	} );

	it( 'saves the chosen site type and redirects to setup page', async () => {
		mockedApiFetch.mockResolvedValueOnce( {} ).mockResolvedValueOnce( {
			oneupdate_site_type: 'governing-site',
		} );

		render( <OnboardingScreen /> );

		const selectControl = await screen.findByLabelText( 'Site Type' );
		fireEvent.change( selectControl, {
			target: { value: 'governing-site' },
		} );

		const submitButton = screen.getByRole( 'button', {
			name: 'Select Current Site Type',
		} );
		fireEvent.click( submitButton );

		await waitFor( () => {
			expect( mockedApiFetch ).toHaveBeenLastCalledWith( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: { oneupdate_site_type: 'governing-site' },
			} );
		} );
	} );

	it( 'shows an error notice when saving fails', async () => {
		mockedApiFetch
			.mockResolvedValueOnce( {} )
			.mockRejectedValueOnce( new Error( 'save failed' ) );

		render( <OnboardingScreen /> );

		const selectControl = await screen.findByLabelText( 'Site Type' );
		fireEvent.change( selectControl, {
			target: { value: 'brand-site' },
		} );

		const submitButton = screen.getByRole( 'button', {
			name: 'Select Current Site Type',
		} );
		fireEvent.click( submitButton );

		expect(
			await screen.findAllByText( 'Error setting site type.' )
		).toHaveLength( 2 );
	} );
} );
