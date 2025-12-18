/**
 * WordPress dependencies
 */
import { useState, useMemo } from 'react';
import {
	Modal,
	TextControl,
	TextareaControl,
	Button,
	Notice,
	ComboboxControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isValidUrl } from '../js/utils';
import type { defaultBrandSite } from '@/admin/settings/page';

interface ErrorsType {
	name: string;
	url: string;
	api_key: string;
	message: string;
	gh_repo: string;
}

interface GitHubRepos {
	slug: string;
	url: string;
	name: string;
}

const SiteModal = (
	{ formData, setFormData, onSubmit, onClose, editing, sites, originalData, allGitHubRepos } :
	{
		formData: typeof defaultBrandSite;
		setFormData: ( data: typeof defaultBrandSite ) => void;
		onSubmit: () => Promise< boolean >;
		onClose: () => void;
		editing: boolean;
		sites: typeof defaultBrandSite[];
		originalData: typeof defaultBrandSite | undefined;
		allGitHubRepos: GitHubRepos[];
	},
) => {
	const [ errors, setErrors ] = useState< ErrorsType >( {
		name: '',
		url: '',
		api_key: '',
		message: '',
		gh_repo: '',
	} );
	const [ showNotice, setShowNotice ] = useState( false );
	const [ isProcessing, setIsProcessing ] = useState( false );

	// Check if form data has changed from original data (only for editing mode)
	const hasChanges = useMemo( () => {
		if ( ! editing ) {
			return true;
		} // Always allow submission for new sites

		return (
			formData.name !== originalData?.name ||
			formData.url !== originalData?.url ||
			formData.api_key !== originalData?.api_key ||
			formData.gh_repo !== originalData?.gh_repo
		);
	}, [ editing, formData, originalData ] );

	const handleSubmit = async ():Promise<void> => {
		// Validate inputs
		let urlError = '';
		if ( ! formData.url.trim() ) {
			urlError = __( 'Site URL is required.', 'oneupdate' );
		} else if ( ! isValidUrl( formData.url ) ) {
			urlError = __( 'Enter a valid URL (must start with http or https).', 'oneupdate' );
		}

		const newErrors = {
			name: ! formData.name.trim() ? __( 'Site Name is required.', 'oneupdate' ) : '',
			url: urlError,
			api_key: ! formData.api_key.trim() ? __( 'API Key is required.', 'oneupdate' ) : '',
			message: '',
			gh_repo: ! formData.gh_repo.trim() ? __( 'GitHub Repository is required.', 'oneupdate' ) : '',
		};

		// make sure site name is under 20 characters
		if ( formData.name.length > 20 ) {
			newErrors.name = __( 'Site Name must be under 20 characters.', 'oneupdate' );
		}

		setErrors( newErrors );
		const hasErrors = Object.values( newErrors ).some( ( err ) => err );

		if ( hasErrors ) {
			setShowNotice( true );
			return;
		}

		// Start processing
		setIsProcessing( true );
		setShowNotice( false );

		try {
			// Perform health-check
			const healthCheck = await fetch(
				`${ formData.url }/wp-json/oneupdate/v1/health-check`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'X-OneUpdate-Token': formData.api_key,
					},
				},
			);

			const healthCheckData = await healthCheck.json();
			if ( ! healthCheckData.success ) {
				setErrors( {
					...newErrors,
					message: __( 'Health check failed, please verify API key and make sure there\'s no governing site connected.', 'oneupdate' ),
				} );
				setShowNotice( true );
				setIsProcessing( false );
				return;
			}

			// check if same url is already added or not.
			let isAlreadyExists = false;
			sites.forEach( ( site ) => {
				const trimmedSiteUrl = site.url.endsWith( '/' )
					? site.url
					: `${ site.url }/`;
				const trimmedFormUrl = formData.url.endsWith( '/' )
					? formData.url
					: `${ formData.url }/`;
				if ( trimmedSiteUrl === trimmedFormUrl ) {
					if ( editing && originalData?.url === formData.url ) {
						// allow if url is same as original url in editing mode
						return;
					}
					isAlreadyExists = true;
				}
			} );

			if ( isAlreadyExists ) {
				setErrors( {
					...newErrors,
					message: __( 'Site URL already exists. Please use a different URL.', 'oneupdate' ),
				} );
				setShowNotice( true );
				setIsProcessing( false );
				return;
			}

			setShowNotice( false );
			const submitResponse = await onSubmit();

			if ( ! submitResponse ) {
				setErrors( {
					...newErrors,
					message: __( 'An error occurred while saving the site. Please try again.', 'oneupdate' ),
				} );
				setShowNotice( true );
			}
		} catch ( error ) {
			setErrors( {
				...newErrors,
				message: __( 'An unexpected error occurred. Please try again.', 'oneupdate' ),
			} );
			setShowNotice( true );
			setIsProcessing( false );
			return;
		} finally {
			setIsProcessing( false );
		}
	};

	// Button should be disabled if:
	// 1. Currently processing, OR
	// 2. Required fields are empty, OR
	// 3. In editing mode and no changes have been made
	const isButtonDisabled = isProcessing ||
		! formData.name ||
		! formData.url ||
		! formData.api_key ||
		! formData.gh_repo ||
		( editing && ! hasChanges );

	return (
		<Modal
			title={ editing ? __( 'Edit Brand Site', 'oneupdate' ) : __( 'Add Brand Site', 'oneupdate' ) }
			onRequestClose={ onClose }
			size="medium"
			shouldCloseOnClickOutside={ true }
		>
			{ showNotice && (
				<Notice
					status="error"
					isDismissible={ true }
					onRemove={ () => setShowNotice( false ) }
				>
					{ errors.message || errors.name || errors.url || errors.api_key }
				</Notice>
			) }

			<TextControl
				label={ __( 'Site Name*', 'oneupdate' ) }
				value={ formData.name }
				onChange={ ( value ) => setFormData( { ...formData, name: value } ) }
				help={ __( 'This is the name of the site that will be registered.', 'oneupdate' ) }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<TextControl
				label={ __( 'Site URL*', 'oneupdate' ) }
				value={ formData.url }
				onChange={ ( value ) => setFormData( { ...formData, url: value } ) }
				help={ __( 'It must start with http or https and end with /, like: https://rtcamp.com/', 'oneupdate' ) }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<ComboboxControl
				label={ __( 'GitHub Repository*', 'oneupdate' ) }
				value={ formData.gh_repo }
				onChange={ ( value ) => setFormData( { ...formData, gh_repo: value || '' } ) }
				options={ allGitHubRepos.map( ( repo ) => ( { label: repo.slug, value: repo.slug } ) ) }
				placeholder={ __( 'Select a repository', 'oneupdate' ) }
				help={ __( 'Select the GitHub repository associated with this site.', 'oneupdate' ) }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<TextareaControl
				label={ __( 'API Key*', 'oneupdate' ) }
				value={ formData.api_key }
				onChange={ ( value ) => setFormData( { ...formData, api_key: value } ) }
				help={ __( 'This is the API key that will be used to authenticate the site for OneUpdate.', 'oneupdate' ) }
				__nextHasNoMarginBottom
			/>

			<Button
				variant="primary"
				onClick={ handleSubmit }
				className={ isProcessing ? 'is-busy' : '' }
				disabled={ isButtonDisabled }
				style={ { marginTop: '12px' } }
			>
				{ (
					editing ? __( 'Update Site', 'oneupdate' ) : __( 'Add Site', 'oneupdate' )
				) }
			</Button>
		</Modal>
	);
};

export default SiteModal;
