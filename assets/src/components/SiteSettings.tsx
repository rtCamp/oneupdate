/**
 * WordPress dependencies
 */
import { useEffect, useState, useCallback } from 'react';
import {
	TextareaControl,
	Button,
	Card,
	Notice,
	Spinner,
	CardHeader,
	CardBody,
	TextControl,
	Modal,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type { NoticeType } from '@/admin/settings/page';

const API_NAMESPACE = window.OneUpdateSettings.restUrl + '/oneupdate/v1';
const NONCE = window.OneUpdateSettings.restNonce;
const API_KEY = window.OneUpdateSettings.api_key;

const SiteSettings = () => {
	const [ api_key, setApiKey ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ notice, setNotice ] = useState< NoticeType | null >( null );
	const [ governingSite, setGoverningSite ] = useState( '' );
	const [ showDisconnectionModal, setShowDisconnectionModal ] = useState( false );

	const fetchApiKey = useCallback( async () => {
		setIsLoading( true );
		try {
			const response = await fetch( API_NAMESPACE + '/secret-key', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': NONCE,
					'X-OneUpdate-Token': API_KEY,
				},
			} );
			if ( ! response.ok ) {
				throw new Error( 'Network response was not ok' );
			}
			const data = await response.json();
			setApiKey( data?.secret_key || '' );
		} catch ( error ) {
			setNotice( {
				type: 'error',
				message: __( 'Failed to fetch API key. Please try again later.', 'oneupdate' ),
			} );
		} finally {
			setIsLoading( false );
		}
	}, [] );

	// regenerate api key using REST endpoint.
	const regenerateApiKey = useCallback( async () => {
		try {
			const response = await fetch( API_NAMESPACE + '/secret-key', {
				method: 'POST',
				headers: {
					'X-WP-Nonce': NONCE,
					'X-OneUpdate-Token': API_KEY,
				},
			} );
			if ( ! response.ok ) {
				throw new Error( 'Network response was not ok' );
			}
			const data = await response.json();
			if ( data?.secret_key ) {
				setApiKey( data.secret_key );
				setNotice( {
					type: 'warning',
					message: __( 'API key regenerated successfully. Please update your old key with this newly generated key to make sure plugin works properly.', 'oneupdate' ),
				} );
			} else {
				setNotice( {
					type: 'error',
					message: __( 'Failed to regenerate API key. Please try again later.', 'oneupdate' ),
				} );
			}
		} catch ( error ) {
			setNotice( {
				type: 'error',
				message: __( 'Error regenerating API key. Please try again later.', 'oneupdate' ),
			} );
		}
	}, [] );

	const fetchCurrentGoverningSite = useCallback( async () => {
		setIsLoading( true );
		try {
			const response = await fetch(
				`${ API_NAMESPACE }/governing-site?${ new Date().getTime() }`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': NONCE,
						'X-OneUpdate-Token': api_key,
					},
				},
			);
			if ( ! response.ok ) {
				throw new Error( 'Network response was not ok' );
			}
			const data = await response.json();
			setGoverningSite( data?.governing_site_url || '' );
		} catch ( error ) {
			setNotice( {
				type: 'error',
				message: __( 'Failed to fetch governing site. Please try again later.', 'oneupdate' ),
			},
			);
		} finally {
			setIsLoading( false );
		}
	}, [ api_key ] );

	const deleteGoverningSiteConnection = useCallback( async () => {
		try {
			const response = await fetch(
				`${ API_NAMESPACE }/governing-site`,
				{
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': NONCE,
						'X-OneUpdate-Token': api_key,
					},
				},
			);
			if ( ! response.ok ) {
				throw new Error( 'Network response was not ok' );
			}
			setGoverningSite( '' );
			setNotice( {
				type: 'success',
				message: __( 'Governing site disconnected successfully.', 'oneupdate' ),
			} );
		} catch ( error ) {
			setNotice( {
				type: 'error',
				message: __( 'Failed to disconnect governing site. Please try again later.', 'oneupdate' ),
			} );
		} finally {
			setShowDisconnectionModal( false );
		}
	}, [ api_key ] );

	const handleDisconnectGoverningSite = useCallback( async () => {
		setShowDisconnectionModal( true );
	}, [] );

	useEffect( () => {
		fetchApiKey();
		fetchCurrentGoverningSite();
	}, [ fetchApiKey, fetchCurrentGoverningSite ] );

	if ( isLoading ) {
		return <Spinner />;
	}

	return (
		<>

			{ notice && (
				<Notice
					status={ notice.type }
					isDismissible={ true }
					onRemove={ () => setNotice( null ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Card style={ { marginTop: '30px' } } >
				<CardHeader>
					<h2>{ __( 'API Key', 'oneupdate' ) }</h2>
					<div>
						{ /* Copy to clipboard button */ }
						<Button
							variant="primary"
							onClick={ () => {
								navigator?.clipboard?.writeText( api_key )
									.then( () => {
										setNotice( {
											type: 'success',
											message: __( 'API key copied to clipboard.', 'oneupdate' ),
										} );
									} )
									.catch( ( error ) => {
										setNotice( {
											type: 'error',
											message: __( 'Failed to copy api key. Please try again.', 'oneupdate' ) + ' ' + error,
										} );
									} );
							} }
						>
							{ __( 'Copy API Key', 'oneupdate' ) }
						</Button>
						{ /* Regenerate key button */ }
						<Button
							variant="secondary"
							onClick={ regenerateApiKey }
							style={ { marginLeft: '10px' } }
						>
							{ __( 'Regenerate API Key', 'oneupdate' ) }
						</Button>
					</div>
				</CardHeader>
				<CardBody>
					<div>
						<TextareaControl
							value={ api_key }
							disabled={ true }
							help={ __( 'This key is used for secure communication with the Governing site.', 'oneupdate' ) }
							__nextHasNoMarginBottom
							onChange={ () => {} } // to avoid ts warning
						/>
					</div>
				</CardBody>

			</Card>
			<Card className="governing-site-connection"
				style={ { marginTop: '30px' } }
			>
				<CardHeader>
					<h2>{ __( 'Governing Site Connection', 'oneupdate' ) }</h2>
					<Button
						variant="secondary"
						isDestructive
						onClick={ handleDisconnectGoverningSite }
						disabled={ governingSite.trim().length === 0 || isLoading }
					>
						{ __( 'Disconnect Governing Site', 'oneupdate' ) }
					</Button>
				</CardHeader>
				<CardBody>
					<TextControl
						label={ __( 'Governing Site URL', 'oneupdate' ) }
						value={ governingSite }
						disabled={ true }
						help={ __( 'This is the URL of the Governing site this Brand site is connected to.', 'oneupdate' ) }
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						onChange={ () => {} } // to avoid ts warning
					/>
				</CardBody>
			</Card>

			{ showDisconnectionModal && (
				<Modal
					title={ __( 'Disconnect Governing Site', 'oneupdate' ) }
					onRequestClose={ () => setShowDisconnectionModal( false ) }
					shouldCloseOnClickOutside={ true }
				>
					<p>{ __( 'Are you sure you want to disconnect from the governing site? This action cannot be undone.', 'oneupdate' ) }</p>
					<div style={ { display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '16px' } }>
						<Button
							variant="secondary"
							onClick={ () => setShowDisconnectionModal( false ) }
						>
							{ __( 'Cancel', 'oneupdate' ) }
						</Button>
						<Button
							variant="primary"
							isDestructive
							onClick={ deleteGoverningSiteConnection }
						>
							{ __( 'Disconnect', 'oneupdate' ) }
						</Button>
					</div>
				</Modal>
			) }
		</>
	);
};

export default SiteSettings;
