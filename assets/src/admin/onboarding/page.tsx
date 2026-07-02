/**
 * WordPress dependencies
 */
/**
 * External dependencies
 */
import { useState, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import {
	Card,
	CardHeader,
	CardBody,
	Notice,
	Button,
	SelectControl,
} from '@wordpress/components';

const BRAND_SITE = 'brand-site';
const GOVERNING_SITE = 'governing-site';

export type SiteType = typeof BRAND_SITE | typeof GOVERNING_SITE;

interface NoticeState {
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
}

// WordPress provides snake_case keys here. Using them intentionally.
// eslint-disable-next-line camelcase
const { nonce, setup_url, site_type } = window.OneUpdateOnboarding;

/**
 * Create NONCE middleware for apiFetch
 */
apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );

const SiteTypeSelector = ( {
	value,
	setSiteType,
}: {
	value: SiteType | '';
	setSiteType: ( v: SiteType | '' ) => void;
} ) => (
	<SelectControl
		label={ __( 'Site Type', 'oneupdate' ) }
		value={ value }
		help={ __(
			"Choose your site's primary purpose. This setting cannot be changed later and affects available features and configurations.",
			'oneupdate'
		) }
		onChange={ ( v: SiteType | '' ) => {
			setSiteType( v );
		} }
		options={ [
			{ label: __( 'Select…', 'oneupdate' ), value: '' },
			{ label: __( 'Brand Site', 'oneupdate' ), value: BRAND_SITE },
			{
				label: __( 'Governing site', 'oneupdate' ),
				value: GOVERNING_SITE,
			},
		] }
	/>
);

const OnboardingScreen = () => {
	const [ siteType, setSiteType ] = useState< SiteType | '' >(
		site_type || ''
	);
	const [ notice, setNotice ] = useState< NoticeState | null >( null );
	const [ isSaving, setIsSaving ] = useState( false );

	useEffect( () => {
		apiFetch< { oneupdate_site_type?: SiteType } >( {
			path: '/wp/v2/settings',
		} )
			.then( ( settings ) => {
				if ( settings?.oneupdate_site_type ) {
					setSiteType( settings.oneupdate_site_type );
				}
			} )
			.catch( () => {
				setNotice( {
					type: 'error',
					message: __( 'Error fetching site type.', 'oneupdate' ),
				} );
			} );
	}, [] ); // for initial component mount

	const handleSiteTypeChange = async ( value: SiteType | '' ) => {
		// Optimistically set site type.
		setSiteType( value );
		setIsSaving( true );

		try {
			await apiFetch< { oneupdate_site_type?: SiteType } >( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: { oneupdate_site_type: value },
			} ).then( ( settings ) => {
				if ( ! settings?.oneupdate_site_type ) {
					throw new Error( 'No site type in response' );
				}

				setSiteType( settings.oneupdate_site_type );

				// Redirect user to setup page.
				if ( setup_url ) {
					window.location.href = setup_url;
				}
			} );
		} catch {
			setNotice( {
				type: 'error',
				message: __( 'Error setting site type.', 'oneupdate' ),
			} );
		} finally {
			setIsSaving( false );
		}
	};

	return (
		<Card>
			{ !! notice?.message && (
				<Notice
					status={ notice?.type ?? 'success' }
					isDismissible
					onRemove={ () => setNotice( null ) }
				>
					{ notice?.message }
				</Notice>
			) }

			<CardHeader>
				<h2>{ __( 'OneUpdate', 'oneupdate' ) }</h2>
			</CardHeader>

			<CardBody className="oneupdate-onboarding-page">
				<SiteTypeSelector
					value={ siteType }
					setSiteType={ setSiteType }
				/>
				<Button
					variant="primary"
					onClick={ () => handleSiteTypeChange( siteType ) }
					disabled={ isSaving || ! siteType }
					style={ { marginTop: '1.5rem' } }
					className={ isSaving ? 'is-busy' : '' }
				>
					{ __( 'Select Current Site Type', 'oneupdate' ) }
				</Button>
			</CardBody>
		</Card>
	);
};

export default OnboardingScreen;
