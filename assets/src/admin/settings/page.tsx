/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from 'react';
import { __ } from '@wordpress/i18n';
import { Snackbar } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import SiteTable from '@/components/SiteTable';
import SiteModal from '@/components/SiteModal';
import SiteSettings from '@/components/SiteSettings';
import GitHubRepoToken from '@/components/GitHubRepoToken';
import S3Credentials from '@/components/S3Credentials';
import type { SiteType } from '../onboarding/page';

export interface NoticeType {
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
}

export interface BrandSite {
	id?: string;
	name: string;
	url: string;
	api_key: string;
    gh_repo: string;
}

export const defaultBrandSite: BrandSite = {
	name: '',
	url: '',
	api_key: '',
	gh_repo: '',
};

export type EditingIndex = number | null;

const NONCE = window.OneUpdateSettings.restNonce;
const SITE_TYPE = window.OneUpdateSettings.siteType as SiteType || '';
const SHARED_SITES_ENDPOINT = '/oneupdate/v1/shared-sites';
const API_NAMESPACE = window.OneUpdateSettings.restUrl + '/oneupdate/v1';

/**
 * Create NONCE middleware for apiFetch
 */
apiFetch.use( apiFetch.createNonceMiddleware( NONCE ) );

const SettingsPage = () => {
	const [ showModal, setShowModal ] = useState( false );
	const [ editingIndex, setEditingIndex ] = useState< EditingIndex >( null );
	const [ sites, setSites ] = useState< BrandSite[] >( [] );
	const [ formData, setFormData ] = useState< BrandSite >( defaultBrandSite );
	const [ notice, setNotice ] = useState< NoticeType | null >( null );

	const [ allGitHubRepos, setAllGitHubRepos ] = useState( [] );
	const fetchAllAvailableGitHubRepos = useCallback( async () => {
		const response = await fetch(
			`${ API_NAMESPACE }/github-repos`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-NONCE': NONCE,
				},
			},
		);
		const data = await response.json();
		if ( data?.repos ) {
			setAllGitHubRepos( data.repos );
		} else {
			setAllGitHubRepos( [] );
		}
	}, [] );

	useEffect( () => {
		if ( SITE_TYPE === 'governing-site' ) {
			fetchAllAvailableGitHubRepos();
		}
	}, [ SITE_TYPE ] );

	useEffect( () => {
		apiFetch<{ shared_sites?: BrandSite[] }>( {
			path: SHARED_SITES_ENDPOINT,
		} )
			.then( ( data ) => {
				if ( data?.shared_sites ) {
					setSites( data?.shared_sites );
				}
			} )
			.catch( () => {
				setNotice( {
					type: 'error',
					message: __( 'Error fetching settings data.', 'oneupdate' ),
				} );
			} );
	}, [] ); // Empty dependency array to run only once on mount

	useEffect( () => {
		if ( SITE_TYPE === 'governing-site' && sites.length > 0 ) {
			document.body.classList.remove( 'oneupdate-missing-brand-sites' );
		}
	}, [ sites ] );

	const handleFormSubmit = async () : Promise< boolean > => {
		const updated : BrandSite[] = editingIndex !== null
			? sites.map( ( item, i ) => ( i === editingIndex ? formData : item ) )
			: [ ...sites, formData ];

		return apiFetch<{ shared_sites?: BrandSite[] }>( {
			path: SHARED_SITES_ENDPOINT,
			method: 'POST',
			data: { sites_data: updated },
		} ).then( ( data ) => {
			if ( ! data?.shared_sites ) {
				throw new Error( 'No shared sites in response' );
			}

			setSites( data.shared_sites );

			if ( data.shared_sites.length === 0 ) {
				// Reloading causes the menus etc to reflect the missing sites.
				window.location.reload();
			}

			setNotice( {
				type: 'success',
				message: __( 'Brand Site saved successfully.', 'oneupdate' ),
			} );
			return true;
		} ).catch( () => {
			setNotice( {
				type: 'error',
				message: __( 'Failed to update shared sites', 'oneupdate' ),
			} );
			return false;
		} ).finally( () => {
			setFormData( defaultBrandSite );
			setShowModal( false );
			setEditingIndex( null );
		} );
	};

	const handleDelete = async ( index : number|null ) : Promise<void> => {
		const updated : BrandSite[] = sites.filter( ( _, i ) => i !== index );

		apiFetch<{ shared_sites?: BrandSite[] }>( {
			path: SHARED_SITES_ENDPOINT,
			method: 'POST',
			data: { sites_data: updated },
		} ).then( ( data ) => {
			if ( ! data?.shared_sites ) {
				throw new Error( 'No shared sites in response' );
			}
			setSites( data.shared_sites );

			if ( data.shared_sites.length === 0 ) {
				// Reloading causes the menus etc to reflect the missing sites.
				window.location.reload();
			} else {
				document.body.classList.remove( 'oneupdate-missing-brand-sites' );
			}
		} ).catch( () => {
			throw new Error( 'Failed to update shared sites' );
		} );
	};

	return (
		<>
			{ !! notice && notice?.message?.length > 0 &&
				<Snackbar
					explicitDismiss={ false }
					onRemove={ () => setNotice( null ) }
					className={ notice?.type === 'error' ? 'oneupdate-error-notice' : 'oneupdate-success-notice' }
				>
					{ notice?.message }
				</Snackbar>
			}

			{ SITE_TYPE === 'brand-site' && (
				<SiteSettings />
			) }

			{ SITE_TYPE === 'governing-site' && (
				<>
					<SiteTable sites={ sites } onEdit={ setEditingIndex } onDelete={ handleDelete } setFormData={ setFormData } setShowModal={ setShowModal } />
					<GitHubRepoToken setNotice={ setNotice } fetchAllAvailableGitHubRepos={ fetchAllAvailableGitHubRepos } />
					<S3Credentials setNotice={ setNotice } />
				</>
			) }

			{ showModal && (
				<SiteModal
					formData={ formData }
					setFormData={ setFormData }
					onSubmit={ handleFormSubmit }
					onClose={ () => {
						setShowModal( false );
						setEditingIndex( null );
						setFormData( defaultBrandSite );
					} }
					editing={ editingIndex !== null }
					sites={ sites }
					originalData={ editingIndex !== null ? sites[ editingIndex ] : undefined }
					allGitHubRepos={ allGitHubRepos }
				/>
			) }
		</>
	);
};

export default SettingsPage;
