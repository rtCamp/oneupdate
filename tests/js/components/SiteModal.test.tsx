/**
 * External dependencies
 */
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Internal dependencies
 */
import SiteModal from '@/components/SiteModal';
import { defaultBrandSite } from '@/admin/settings/page';

const baseFormData = {
	...defaultBrandSite,
	name: 'Brand Site',
	url: 'https://brand.example.com',
	api_key: 'secret-key',
	gh_repo: 'org/repo-a',
};

const mockRepos = [
	{
		slug: 'org/repo-a',
		url: 'https://github.com/org/repo-a',
		name: 'repo-a',
	},
	{
		slug: 'org/repo-b',
		url: 'https://github.com/org/repo-b',
		name: 'repo-b',
	},
];

function SiteModalHarness( {
	initialData = baseFormData,
	editing = false,
	sites = [],
	originalData,
	onSubmit = jest.fn().mockResolvedValue( true ),
	onClose = jest.fn(),
}: {
	initialData?: typeof defaultBrandSite;
	editing?: boolean;
	sites?: Array< typeof defaultBrandSite >;
	originalData?: typeof defaultBrandSite;
	onSubmit?: jest.Mock< Promise< boolean >, [] >;
	onClose?: jest.Mock< void, [] >;
} ) {
	const [ formData, setFormData ] = useState( initialData );

	return (
		<SiteModal
			formData={ formData }
			setFormData={ setFormData }
			onSubmit={ onSubmit }
			onClose={ onClose }
			editing={ editing }
			sites={ sites }
			originalData={ originalData }
			allGitHubRepos={ mockRepos }
		/>
	);
}

describe( 'SiteModal', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	it( 'disables submit when editing without changes', () => {
		render(
			<SiteModalHarness
				editing
				initialData={ baseFormData }
				originalData={ baseFormData }
			/>
		);

		expect(
			screen.getByRole( 'button', { name: /Update Site/i } )
		).toBeDisabled();
	} );

	it( 'enables submit when editing with changes', () => {
		render(
			<SiteModalHarness
				editing
				initialData={ { ...baseFormData, name: 'Changed Name' } }
				originalData={ baseFormData }
			/>
		);

		expect(
			screen.getByRole( 'button', { name: /Update Site/i } )
		).toBeEnabled();
	} );

	it( 'shows validation feedback for invalid input', async () => {
		render(
			<SiteModalHarness
				initialData={ {
					name: 'A very long site name beyond twenty characters limit',
					url: 'invalid-url',
					api_key: 'secret-key',
					gh_repo: 'org/repo-a',
				} }
			/>
		);

		const submitButton = screen.getByRole( 'button', {
			name: /Add Site/i,
		} );
		fireEvent.click( submitButton );

		// We check DOM directly since WordPress notices can render twice/or with a11y regions
		await waitFor( () => {
			const noticeEl = document.querySelector(
				'.components-notice__content'
			);
			expect( noticeEl ).toBeInTheDocument();
			expect( noticeEl?.textContent ).toContain(
				'Site Name must be under 20 characters.'
			);
		} );
	} );

	it( 'prevents duplicate site urls after a successful health check', async () => {
		const onSubmit = jest.fn().mockResolvedValue( true );
		global.fetch = jest.fn().mockResolvedValue( {
			json: jest.fn().mockResolvedValue( { success: true } ),
		} ) as typeof fetch;

		render(
			<SiteModalHarness
				onSubmit={ onSubmit }
				sites={ [
					{
						name: 'Existing',
						url: 'https://brand.example.com/',
						api_key: 'existing-key',
						gh_repo: 'org/repo-a',
					},
				] }
			/>
		);

		const submitButton = screen.getByRole( 'button', {
			name: /Add Site/i,
		} );
		fireEvent.click( submitButton );

		await waitFor( () => {
			const noticeEl = document.querySelector(
				'.components-notice__content'
			);
			expect( noticeEl ).toBeInTheDocument();
			expect( noticeEl?.textContent ).toContain(
				'Site URL already exists. Please use a different URL.'
			);
		} );

		expect( onSubmit ).not.toHaveBeenCalled();
	} );

	it( 'triggers onSubmit callback after successful health check', async () => {
		const onSubmit = jest.fn().mockResolvedValue( true );
		global.fetch = jest.fn().mockResolvedValue( {
			json: jest.fn().mockResolvedValue( { success: true } ),
		} ) as typeof fetch;

		render( <SiteModalHarness onSubmit={ onSubmit } /> );

		const submitButton = screen.getByRole( 'button', {
			name: /Add Site/i,
		} );
		fireEvent.click( submitButton );

		await waitFor( () => {
			expect( global.fetch ).toHaveBeenCalledWith(
				expect.stringContaining(
					'https://brand.example.com/wp-json/oneupdate/v1/health-check'
				),
				expect.objectContaining( {
					method: 'GET',
					headers: expect.objectContaining( {
						'X-OneUpdate-Token': 'secret-key',
					} ),
				} )
			);
		} );

		await waitFor( () => {
			expect( onSubmit ).toHaveBeenCalled();
		} );
	} );

	it( 'shows error notice when health check fails', async () => {
		const onSubmit = jest.fn();
		global.fetch = jest.fn().mockResolvedValue( {
			json: jest.fn().mockResolvedValue( { success: false } ),
		} ) as typeof fetch;

		render( <SiteModalHarness onSubmit={ onSubmit } /> );

		const submitButton = screen.getByRole( 'button', {
			name: /Add Site/i,
		} );
		fireEvent.click( submitButton );

		await waitFor( () => {
			const noticeEl = document.querySelector(
				'.components-notice__content'
			);
			expect( noticeEl ).toBeInTheDocument();
			expect( noticeEl?.textContent ).toContain(
				"Health check failed, please verify API key and make sure there's no governing site connected."
			);
		} );

		expect( onSubmit ).not.toHaveBeenCalled();
	} );
} );
