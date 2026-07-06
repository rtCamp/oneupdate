jest.mock( 'react', () => jest.requireActual( 'react' ) );
jest.mock( '@wordpress/element', () =>
	jest.requireActual( '@wordpress/element' )
);
/**
 * External dependencies
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

// Mock child components to isolate SettingsPage behavior
jest.mock( '@/components/SiteTable', () => ( {
	__esModule: true,
	default: ( {
		sites,
		onEdit,
		onDelete,
		setFormData,
		setShowModal,
	}: {
		sites: Array< any >;
		onEdit: ( index: number ) => void;
		onDelete: ( index: number | null ) => void;
		setFormData: ( data: any ) => void;
		setShowModal: ( show: boolean ) => void;
	} ) => (
		<div data-testid="site-table">
			<span data-testid="site-count">{ sites.length }</span>
			<button
				type="button"
				onClick={ () => {
					onEdit( 0 );
					setFormData( {
						name: 'Edited Brand Site',
						url: 'https://edited.example.com/',
						api_key: 'edited-key',
						gh_repo: 'org/repo-a',
					} );
				} }
			>
				Edit Site
			</button>
			<button type="button" onClick={ () => setShowModal( true ) }>
				Open Modal
			</button>
			<button type="button" onClick={ () => onDelete( 0 ) }>
				Delete Site
			</button>
		</div>
	),
} ) );

jest.mock( '@/components/SiteModal', () => ( {
	__esModule: true,
	default: ( {
		onSubmit,
		onClose,
	}: {
		onSubmit: () => Promise< boolean >;
		onClose: () => void;
	} ) => (
		<div data-testid="site-modal">
			<button type="button" onClick={ () => void onSubmit() }>
				Submit Modal
			</button>
			<button type="button" onClick={ onClose }>
				Close Modal
			</button>
		</div>
	),
} ) );

jest.mock( '@/components/SiteSettings', () => ( {
	__esModule: true,
	default: () => <div data-testid="site-settings">Brand Site Settings</div>,
} ) );

jest.mock( '@/components/GitHubRepoToken', () => ( {
	__esModule: true,
	default: () => <div data-testid="github-repo-token">GitHub Repo Token</div>,
} ) );

jest.mock( '@/components/S3Credentials', () => ( {
	__esModule: true,
	default: () => <div data-testid="s3-credentials">S3 Credentials</div>,
} ) );

import SettingsPage from '@/admin/settings/page';

const mockedApiFetch = apiFetch as jest.MockedFunction< typeof apiFetch >;

describe( 'SettingsPage', () => {
	beforeEach( () => {
		mockedApiFetch.mockReset();
		window.OneUpdateSettings = {
			...window.OneUpdateSettings,
			siteType: 'governing-site',
		};
		document.body.className = '';
		global.fetch = jest.fn().mockResolvedValue( {
			ok: true,
			json: () => Promise.resolve( { repos: [] } ),
		} ) as typeof fetch;
	} );

	it( 'loads shared sites and renders the page structure for governing-site', async () => {
		mockedApiFetch.mockResolvedValueOnce( {
			shared_sites: [
				{
					name: 'Brand Site',
					url: 'https://brand.example.com/',
					api_key: 'key',
					gh_repo: 'org/repo-a',
				},
			],
		} );

		render( <SettingsPage /> );

		await waitFor( () => {
			expect( screen.getByTestId( 'site-count' ) ).toHaveTextContent(
				'1'
			);
		} );

		expect( screen.getByTestId( 'github-repo-token' ) ).toBeInTheDocument();
		expect( screen.getByTestId( 's3-credentials' ) ).toBeInTheDocument();
		expect(
			screen.queryByTestId( 'site-settings' )
		).not.toBeInTheDocument();
	} );

	it( 'renders the page structure for brand-site', async () => {
		window.OneUpdateSettings.siteType = 'brand-site';

		let SettingsPageForBrand: any;
		let isolatedApiFetch: any;
		jest.isolateModules( () => {
			SettingsPageForBrand = require( '@/admin/settings/page' ).default;
			isolatedApiFetch = require( '@wordpress/api-fetch' ).default;
		} );

		isolatedApiFetch.mockResolvedValueOnce( {
			shared_sites: [],
		} );

		render( <SettingsPageForBrand /> );

		await waitFor( () => {
			expect( screen.getByTestId( 'site-settings' ) ).toBeInTheDocument();
		} );

		expect( screen.queryByTestId( 'site-table' ) ).not.toBeInTheDocument();
		expect(
			screen.queryByTestId( 'github-repo-token' )
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId( 's3-credentials' )
		).not.toBeInTheDocument();
	} );

	it( 'shows an error notice when initial data load fails', async () => {
		mockedApiFetch.mockRejectedValueOnce( new Error( 'load failed' ) );

		render( <SettingsPage /> );

		const noticeEls = await screen.findAllByText(
			'Error fetching settings data.'
		);
		expect( noticeEls.length ).toBeGreaterThanOrEqual( 1 );
	} );

	it( 'saves site changes, triggers reload if it is the first site, and shows success notice', async () => {
		mockedApiFetch
			.mockResolvedValueOnce( { shared_sites: [] } )
			.mockResolvedValueOnce( {
				shared_sites: [
					{
						name: 'Brand Site',
						url: 'https://brand.example.com/',
						api_key: 'key',
						gh_repo: 'org/repo-a',
					},
				],
			} );

		render( <SettingsPage /> );

		fireEvent.click(
			await screen.findByRole( 'button', { name: 'Open Modal' } )
		);
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Submit Modal' } )
		);

		await waitFor( () => {
			expect( mockedApiFetch ).toHaveBeenLastCalledWith( {
				path: '/oneupdate/v1/shared-sites',
				method: 'POST',
				data: {
					sites_data: [
						{
							name: '',
							url: '',
							api_key: '',
							gh_repo: '',
						},
					],
				},
			} );
		} );

		const successNotices = await screen.findAllByText(
			'Brand Site saved successfully.'
		);
		expect( successNotices.length ).toBeGreaterThanOrEqual( 1 );
	} );

	it( 'deletes site and reloads if no sites are left', async () => {
		mockedApiFetch
			.mockResolvedValueOnce( {
				shared_sites: [
					{
						name: 'Brand Site',
						url: 'https://brand.example.com/',
						api_key: 'key',
						gh_repo: 'org/repo-a',
					},
				],
			} )
			.mockResolvedValueOnce( {
				shared_sites: [],
			} );

		render( <SettingsPage /> );

		await screen.findByTestId( 'site-table' );

		fireEvent.click(
			screen.getByRole( 'button', { name: 'Delete Site' } )
		);

		await waitFor( () => {
			expect( mockedApiFetch ).toHaveBeenLastCalledWith( {
				path: '/oneupdate/v1/shared-sites',
				method: 'POST',
				data: { sites_data: [] },
			} );
		} );
	} );
} );
