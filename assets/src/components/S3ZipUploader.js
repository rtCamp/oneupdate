/**
 * WordPress dependencies
 */
import {
	Button,
	Spinner,
	Card,
	CardBody,
	CardHeader,
	Modal,
	Dashicon,
	CheckboxControl,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
	Notice,
	FormFileUpload,
} from '@wordpress/components';
import { useState, useEffect, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { upload } from '@wordpress/icons';

const API_NAMESPACE = window.OneUpdatePlugins.restUrl + '/oneupdate/v1';
const RestNonce = window.OneUpdatePlugins.restNonce;

const PluginSelectionModal = ( {
	history,
	onClose,
	onNext,
	selectedPlugins,
	setSelectedPlugins,
} ) => {
	const availablePlugins = history.filter(
		( item ) =>
			new Date( item.upload_time ).getTime() > Date.now() - 60 * 60 * 1000
	);

	const handleSelectAllPlugins = () => {
		if ( selectedPlugins.length === availablePlugins.length ) {
			// Deselect all
			setSelectedPlugins( [] );
		} else {
			// Select all
			setSelectedPlugins(
				availablePlugins.map( ( plugin ) => plugin.presigned_url )
			);
		}
	};

	return (
		<Modal
			title={ __( 'Select Plugins to Install', 'oneupdate' ) }
			onRequestClose={ onClose }
			shouldCloseOnClickOutside
			className="oneupdate-plugin-selection-modal"
			style={ { maxWidth: '600px', minWidth: '600px' } }
		>
			<div style={ { paddingTop: '24px' } }>
				<VStack spacing={ 4 }>
					{ /* Action Description */ }
					<div>
						<p
							style={ {
								margin: 0,
								color: '#6c757d',
								fontSize: '14px',
							} }
						>
							{ __(
								'Select the plugins you want to install on your sites. Only plugins uploaded within the last hour are shown.',
								'oneupdate'
							) }
						</p>
					</div>

					{ /* Plugin Selection */ }
					<div>
						{ availablePlugins.length > 0 ? (
							<>
								<div
									style={ {
										marginBottom: '16px',
										display: 'flex',
										flexDirection: 'row',
										gap: '8px',
										alignItems: 'center',
									} }
								>
									<CheckboxControl
										label={ __(
											'Select All Plugins',
											'oneupdate'
										) }
										checked={
											selectedPlugins.length ===
												availablePlugins.length &&
											availablePlugins.length > 0
										}
										onChange={ handleSelectAllPlugins }
										style={ { fontWeight: '500' } }
									/>
									<Button
										variant="link"
										onClick={ () =>
											setSelectedPlugins( [] )
										}
										disabled={
											selectedPlugins.length === 0
										}
										style={ {
											fontWeight: '500',
											marginBottom: '8px',
										} }
									>
										{ __( 'Clear Selection', 'oneupdate' ) }
									</Button>
								</div>

								<div
									style={ {
										maxHeight: '300px',
										overflowY: 'auto',
										border: '1px solid #e1e5e9',
										borderRadius: '8px',
										padding: '16px',
									} }
								>
									<VStack spacing={ 2 }>
										{ availablePlugins.map(
											( item, index ) => (
												<div
													key={ index }
													style={ {
														padding: '8px',
														border: '1px solid #f0f0f1',
														borderRadius: '4px',
														cursor: 'pointer',
													} }
													role="button"
													tabIndex={ 0 }
													onKeyDown={ ( e ) => {
														if (
															e.key === 'Enter' ||
															e.key === ' '
														) {
															e.preventDefault();
															setSelectedPlugins(
																( prev ) =>
																	prev.includes(
																		item.presigned_url
																	)
																		? prev.filter(
																				(
																					plugin
																				) =>
																					plugin !==
																					item.presigned_url
																		  )
																		: [
																				...prev,
																				item.presigned_url,
																		  ]
															);
														}
													} }
													aria-pressed={ selectedPlugins.includes(
														item.presigned_url
													) }
													onClick={ ( event ) => {
														event.stopPropagation();
														setSelectedPlugins(
															( prev ) =>
																prev.includes(
																	item.presigned_url
																)
																	? prev.filter(
																			(
																				plugin
																			) =>
																				plugin !==
																				item.presigned_url
																	  )
																	: [
																			...prev,
																			item.presigned_url,
																	  ]
														);
													} }
												>
													<CheckboxControl
														className="oneupdate-site-checkbox"
														label={
															<div>
																<div
																	style={ {
																		fontWeight:
																			'500',
																		color: '#23282d',
																	} }
																>
																	{
																		item.file_name
																	}
																</div>
																<div
																	style={ {
																		fontSize:
																			'12px',
																		color: '#6c757d',
																	} }
																>
																	{ __(
																		'Uploaded:',
																		'oneupdate'
																	) }{ ' ' }
																	{ new Date(
																		item.upload_time
																	).toLocaleString() }
																</div>
															</div>
														}
														checked={ selectedPlugins.includes(
															item.presigned_url
														) }
													/>
												</div>
											)
										) }
									</VStack>
								</div>
							</>
						) : (
							<Notice status="warning" isDismissible={ false }>
								<p style={ { margin: 0 } }>
									{ __(
										'No plugins uploaded within the last hour.',
										'oneupdate'
									) }
								</p>
							</Notice>
						) }
					</div>

					{ /* Action Buttons */ }
					<HStack justify="flex-end" spacing={ 3 }>
						<Button variant="secondary" onClick={ onClose }>
							{ __( 'Cancel', 'oneupdate' ) }
						</Button>
						<Button
							variant="primary"
							onClick={ onNext }
							disabled={ selectedPlugins.length === 0 }
						>
							<Dashicon
								icon="arrow-right-alt"
								style={ { marginRight: '8px' } }
							/>
							{ __( 'Next: Select Sites', 'oneupdate' ) }
						</Button>
					</HStack>
				</VStack>
			</div>
		</Modal>
	);
};

const SiteSelectionModal = ( {
	sharedSites,
	onClose,
	onBack,
	selectedSiteInfo,
	setSelectedSiteInfo,
	selectedPlugins,
	onInstall,
	applyingPlugins,
} ) => {
	const handleSelectAllSites = () => {
		if ( selectedSiteInfo.length === sharedSites.length ) {
			// Deselect all
			setSelectedSiteInfo( [] );
		} else {
			// Select all
			setSelectedSiteInfo(
				sharedSites.map( ( site ) => ( {
					url: site.url,
					name: site.name,
					api_key: site.api_key,
					gh_repo: site.gh_repo,
				} ) )
			);
		}
	};

	return (
		<Modal
			title={ __( 'Select Sites for Installation', 'oneupdate' ) }
			onRequestClose={ onClose }
			shouldCloseOnClickOutside={ applyingPlugins ? false : true }
			className="oneupdate-site-selection-modal"
			style={ { maxWidth: '600px', minWidth: '600px' } }
		>
			<div style={ { paddingTop: '24px' } }>
				<VStack spacing={ 4 }>
					{ /* Action Description */ }
					<div>
						<p
							style={ {
								margin: 0,
								color: '#6c757d',
								fontSize: '14px',
							} }
						>
							{ __(
								'Choose the sites where you want to install the selected plugins. You have selected',
								'oneupdate'
							) }{ ' ' }
							<strong>{ selectedPlugins.length }</strong>{ ' ' }
							{ selectedPlugins.length === 1
								? __( 'plugin', 'oneupdate' )
								: __( 'plugins', 'oneupdate' ) }
							.
						</p>
					</div>

					{ /* Site Selection */ }
					<div>
						{ sharedSites.length > 0 ? (
							<>
								<div
									style={ {
										marginBottom: '16px',
										display: 'flex',
										flexDirection: 'row',
										gap: '8px',
										alignItems: 'center',
									} }
								>
									<CheckboxControl
										label={ __(
											'Select All Sites',
											'oneupdate'
										) }
										checked={
											selectedSiteInfo.length ===
												sharedSites.length &&
											sharedSites.length > 0
										}
										onChange={ handleSelectAllSites }
										style={ { fontWeight: '500' } }
										disabled={ applyingPlugins }
									/>
									<Button
										variant="link"
										onClick={ () =>
											setSelectedSiteInfo( [] )
										}
										disabled={
											selectedSiteInfo.length === 0 ||
											applyingPlugins
										}
										style={ {
											fontWeight: '500',
											marginBottom: '8px',
										} }
									>
										{ __( 'Clear Selection', 'oneupdate' ) }
									</Button>
								</div>

								<div
									style={ {
										maxHeight: '300px',
										overflowY: 'auto',
										border: '1px solid #e1e5e9',
										borderRadius: '8px',
										padding: '16px',
									} }
								>
									<VStack spacing={ 2 }>
										{ sharedSites.map( ( site, index ) => (
											<div
												key={ index }
												style={ {
													padding: '8px',
													border: '1px solid #f0f0f1',
													borderRadius: '4px',
													cursor: 'pointer',
												} }
												role="button"
												tabIndex={ 0 }
												onKeyDown={ ( e ) => {
													if ( applyingPlugins ) {
														e.preventDefault();
														return;
													}
													if (
														e.key === 'Enter' ||
														e.key === ' '
													) {
														e.preventDefault();
														setSelectedSiteInfo(
															( prev ) =>
																prev.some(
																	( s ) =>
																		s.url ===
																		site.url
																)
																	? prev.filter(
																			(
																				s
																			) =>
																				s.url !==
																				site.url
																	  )
																	: [
																			...prev,
																			{
																				url: site.url,
																				name: site.name,
																				api_key:
																					site.api_key,
																				gh_repo:
																					site.gh_repo,
																			},
																	  ]
														);
													}
												} }
												aria-pressed={ selectedSiteInfo.includes(
													site.url
												) }
												onClick={ ( event ) => {
													event.stopPropagation();

													if ( applyingPlugins ) {
														event.preventDefault();
														return;
													}

													setSelectedSiteInfo(
														( prev ) =>
															prev.some(
																( s ) =>
																	s.url ===
																	site.url
															)
																? prev.filter(
																		( s ) =>
																			s.url !==
																			site.url
																  )
																: [
																		...prev,
																		{
																			url: site.url,
																			name: site.name,
																			api_key:
																				site.api_key,
																			gh_repo:
																				site.gh_repo,
																		},
																  ]
													);
												} }
											>
												<CheckboxControl
													className="oneupdate-site-checkbox"
													label={
														<div>
															<div
																style={ {
																	fontWeight:
																		'500',
																	color: '#23282d',
																} }
															>
																{ site.name }
															</div>
															<div
																style={ {
																	fontSize:
																		'12px',
																	color: '#6c757d',
																} }
															>
																{ site.url }
															</div>
														</div>
													}
													checked={ selectedSiteInfo.some(
														( s ) =>
															s.url === site.url
													) }
													disabled={ applyingPlugins }
												/>
											</div>
										) ) }
									</VStack>
								</div>
							</>
						) : (
							<Notice status="warning" isDismissible={ false }>
								<p style={ { margin: 0 } }>
									{ __(
										'No sites available for plugin installation.',
										'oneupdate'
									) }
								</p>
							</Notice>
						) }
					</div>

					{ /* Action Buttons */ }
					<HStack justify="flex-end" spacing={ 3 }>
						<Button
							variant="secondary"
							onClick={ onBack }
							disabled={ applyingPlugins }
						>
							<Dashicon
								icon="arrow-left-alt"
								style={ { marginRight: '8px' } }
							/>
							{ __( 'Back', 'oneupdate' ) }
						</Button>
						<Button
							variant="secondary"
							onClick={ onClose }
							disabled={ applyingPlugins }
						>
							{ __( 'Cancel', 'oneupdate' ) }
						</Button>
						<Button
							variant="primary"
							onClick={ onInstall }
							disabled={
								selectedPlugins.length === 0 ||
								selectedSiteInfo.length === 0 ||
								applyingPlugins
							}
							isBusy={ applyingPlugins }
						>
							<Dashicon
								icon="admin-plugins"
								style={ { marginRight: '8px' } }
							/>
							{ applyingPlugins
								? __( 'Installing…', 'oneupdate' )
								: __( 'Install Plugins', 'oneupdate' ) }
						</Button>
					</HStack>
				</VStack>
			</div>
		</Modal>
	);
};

const ApplyPluginsModal = ( {
	history,
	setShowApplyPluginsModal,
	setCurrentNotice,
	applyingPlugins,
	setApplyingPlugins,
} ) => {
	const [ selectedPlugins, setSelectedPlugins ] = useState( [] );
	const [ selectedSiteInfo, setSelectedSiteInfo ] = useState( [] );
	const [ sharedSites, setSharedSites ] = useState( [] );

	// Modal state management
	const [ currentStep, setCurrentStep ] = useState( 'plugins' ); // 'plugins' or 'sites'

	const fetchSharedSitesData = useCallback( async () => {
		const response = await fetch( `${ API_NAMESPACE }/shared-sites`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': RestNonce,
			},
		} );
		const data = await response.json();
		if ( data?.shared_sites ) {
			setSharedSites( data.shared_sites );
		} else {
			setSharedSites( [] );
		}
	}, [] );

	useEffect( () => {
		fetchSharedSitesData();
	}, [] );

	const applySelectedPlugins = useCallback( async () => {
		setApplyingPlugins( true );
		try {
			const response = await fetch(
				`${ API_NAMESPACE }/apply-private-plugins`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': RestNonce,
					},
					body: JSON.stringify( {
						sites: selectedSiteInfo,
						plugins: selectedPlugins,
					} ),
				}
			);
			if ( ! response.ok ) {
				setCurrentNotice( {
					status: 'error',
					message: __( 'Network response was not ok', 'oneupdate' ),
				} );
				throw new Error( 'Network response was not ok' );
			}
			const data = await response.json();
			if ( data.success ) {
				// Group results by site name and format message
				let noticeMessage = __(
					'Plugins applied successfully.',
					'oneupdate'
				);

				if (
					data.results &&
					Array.isArray( data.results ) &&
					data.results.length > 0
				) {
					// Group actions by site name
					const groupedBySite = data.results.reduce(
						( acc, result ) => {
							const name = result.name || 'Unknown Site';
							if ( ! acc[ name ] ) {
								acc[ name ] = [];
							}
							acc[ name ].push( result );
							return acc;
						},
						{}
					);

					// Format the message with site names and their respective URLs (each URL on new line)
					const siteGroups = Object.entries( groupedBySite ).map(
						( [ name, results ] ) => {
							const actionLinks = results
								.map( ( result ) => result.run_url )
								.join( '\n' );
							return `${ name }\n${ actionLinks }`;
						}
					);

					noticeMessage += `\n\n${ siteGroups.join( '\n\n' ) }`;
				}

				setCurrentNotice( {
					status: 'success',
					message: noticeMessage,
				} );
				setShowApplyPluginsModal( false );
			} else {
				setCurrentNotice( {
					status: 'error',
					message:
						__( 'Failed to apply plugins:', 'oneupdate' ) +
						data.message,
				} );
			}
		} catch ( error ) {
			setCurrentNotice( {
				status: 'error',
				message: __(
					'An error occurred while applying plugins.',
					'oneupdate'
				),
			} );
		} finally {
			setApplyingPlugins( false );
		}
	}, [
		selectedPlugins,
		setShowApplyPluginsModal,
		selectedSiteInfo,
		setCurrentNotice,
	] );

	const handleClose = () => {
		setShowApplyPluginsModal( false );
		setCurrentStep( 'plugins' );
		setSelectedPlugins( [] );
		setSelectedSiteInfo( [] );
	};

	const handleNext = () => {
		setCurrentStep( 'sites' );
	};

	const handleBack = () => {
		setCurrentStep( 'plugins' );
	};

	const handleInstall = async () => {
		if ( selectedPlugins.length === 0 ) {
			setCurrentNotice( {
				status: 'error',
				message: __(
					'Please select at least one plugin to apply.',
					'oneupdate'
				),
			} );
			return;
		}

		if ( selectedSiteInfo.length === 0 ) {
			setCurrentNotice( {
				status: 'error',
				message: __(
					'Please select at least one site to install plugins on.',
					'oneupdate'
				),
			} );
			return;
		}

		await applySelectedPlugins();
	};

	return (
		<>
			{ currentStep === 'plugins' && (
				<PluginSelectionModal
					history={ history }
					onClose={ handleClose }
					onNext={ handleNext }
					selectedPlugins={ selectedPlugins }
					setSelectedPlugins={ setSelectedPlugins }
				/>
			) }

			{ currentStep === 'sites' && (
				<SiteSelectionModal
					sharedSites={ sharedSites }
					onClose={ handleClose }
					onBack={ handleBack }
					selectedSiteInfo={ selectedSiteInfo }
					setSelectedSiteInfo={ setSelectedSiteInfo }
					selectedPlugins={ selectedPlugins }
					onInstall={ handleInstall }
					applyingPlugins={ applyingPlugins }
				/>
			) }
		</>
	);
};

const S3ZipUploader = () => {
	const [ file, setFile ] = useState( null );
	const [ uploading, setUploading ] = useState( false );
	const [ history, setHistory ] = useState( [] );
	const [ loadingHistory, setLoadingHistory ] = useState( true );
	const [ showApplyPluginsModal, setShowApplyPluginsModal ] =
		useState( false );
	const [ showSiteSelectionModal, setShowSiteSelectionModal ] =
		useState( false );
	const [ currentNotice, setCurrentNotice ] = useState( {
		status: '',
		message: '',
	} );
	const [ buttonTexts, setButtonTexts ] = useState( {} );
	const [ selectedSitesForUpload, setSelectedSitesForUpload ] = useState(
		[]
	);
	const [ sharedSites, setSharedSites ] = useState( [] );
	const [ applyingPlugins, setApplyingPlugins ] = useState( false );

	// Fetch shared sites data
	const fetchSharedSitesData = useCallback( async () => {
		try {
			const response = await fetch( `${ API_NAMESPACE }/shared-sites`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': RestNonce,
				},
			} );
			const data = await response.json();
			if ( data?.shared_sites ) {
				setSharedSites( data.shared_sites );
			} else {
				setSharedSites( [] );
			}
		} catch ( error ) {
			setSharedSites( [] );
		}
	}, [] );

	// Fetch upload history
	const fetchHistory = () => {
		setLoadingHistory( true );
		apiFetch( { path: '/oneupdate/v1/history' } )
			.then( ( data ) => {
				setHistory( data );
				// Initialize button texts for each history item
				const initialButtonTexts = {};
				data.forEach( ( item ) => {
					initialButtonTexts[ item.presigned_url ] = __(
						'Copy URL',
						'oneupdate'
					);
				} );
				setButtonTexts( initialButtonTexts );
				setLoadingHistory( false );
			} )
			.catch( () => {
				setLoadingHistory( false );
			} );
	};

	useEffect( () => {
		fetchHistory();
		fetchSharedSitesData();
	}, [] );

	// Handle file selection
	const handleFileChange = ( event ) => {
		setFile( event.target.files[ 0 ] );
	};

	// Handle upload private plugin button click - show site selection modal
	const handleUploadPrivatePlugin = () => {
		if ( ! file ) {
			setCurrentNotice( {
				status: 'error',
				message: __( 'Please select a ZIP file.', 'oneupdate' ),
			} );
			return;
		}
		setShowSiteSelectionModal( true );
	};

	// Handle actual file upload after site selection
	const handleConfirmUpload = async () => {
		if ( selectedSitesForUpload.length === 0 ) {
			setCurrentNotice( {
				status: 'error',
				message: __( 'Please select at least one site.', 'oneupdate' ),
			} );
			return;
		}

		setUploading( true );

		try {
			// First upload to S3
			const formData = new FormData();
			formData.append( 'file', file );

			let uploadResponse = await fetch( `${ API_NAMESPACE }/upload`, {
				method: 'POST',
				headers: {
					'X-WP-Nonce': RestNonce,
				},
				body: formData,
			} );

			uploadResponse = await uploadResponse.json();

			if ( ! uploadResponse || ! uploadResponse.presigned_url ) {
				setCurrentNotice( {
					status: 'error',
					message: __( 'Failed to upload plugin zip.', 'oneupdate' ),
				} );
				setUploading( false );
				return;
			}

			// Extract presigned_url from response
			const presignedUrl = uploadResponse.presigned_url;

			if ( ! presignedUrl ) {
				throw new Error(
					'No presigned URL received from upload response'
				);
			}

			// Now trigger GitHub actions with the presigned URL
			const applyResponse = await fetch(
				`${ API_NAMESPACE }/apply-private-plugins`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': RestNonce,
					},
					body: JSON.stringify( {
						sites: selectedSitesForUpload,
						plugins: [ presignedUrl ],
					} ),
				}
			);

			if ( ! applyResponse.ok ) {
				throw new Error( 'Failed to apply plugin to selected sites' );
			}

			const applyData = await applyResponse.json();

			if ( applyData.success ) {
				// Group results by site name and format message
				let noticeMessage = __(
					'Plugin uploaded and applied successfully!',
					'oneupdate'
				);

				if (
					applyData.results &&
					Array.isArray( applyData.results ) &&
					applyData.results.length > 0
				) {
					// Group actions by site name
					const groupedBySite = applyData.results.reduce(
						( acc, result ) => {
							const name = result.name || 'Unknown Site';
							if ( ! acc[ name ] ) {
								acc[ name ] = [];
							}
							acc[ name ].push( result );
							return acc;
						},
						{}
					);

					// Format the message with site names and their respective URLs (each URL on new line)
					const siteGroups = Object.entries( groupedBySite ).map(
						( [ name, results ] ) => {
							const actionLinks = results
								.map( ( result ) => result.run_url )
								.join( '\n' );
							return `${ name }\n${ actionLinks }`;
						}
					);

					noticeMessage += `\n\n${ siteGroups.join( '\n\n' ) }`;
				}

				setCurrentNotice( {
					status: 'success',
					message: noticeMessage,
				} );
			} else {
				setCurrentNotice( {
					status: 'error',
					message:
						__(
							'Plugin uploaded but failed to apply:',
							'oneupdate'
						) + applyData.message,
				} );
			}

			// Reset form
			setFile( null );
			setSelectedSitesForUpload( [] );
			// Re-fetch history to ensure it reflects server state
			fetchHistory();
		} catch ( error ) {
			setCurrentNotice( {
				status: 'error',
				message: __( 'Upload failed:', 'oneupdate' ) + error.message,
			} );
		} finally {
			setUploading( false );
			setShowSiteSelectionModal( false );
		}
	};

	// Handle copy URL button click
	const handleCopyUrl = ( url ) => {
		navigator?.clipboard?.writeText( url );
		setButtonTexts( ( prev ) => ( {
			...prev,
			[ url ]: __( 'Copied URL', 'oneupdate' ),
		} ) );
		// Revert button text after 3 seconds
		setTimeout( () => {
			setButtonTexts( ( prev ) => ( {
				...prev,
				[ url ]: __( 'Copy URL', 'oneupdate' ),
			} ) );
		}, 3000 );
	};

	// filter out expired items from history
	const filteredHistory = history.filter( ( item ) => {
		const uploadDate = new Date( item.upload_time );
		const oneHourInMs = 60 * 60 * 1000;
		const isExpired = uploadDate.getTime() < Date.now() - oneHourInMs;
		return ! isExpired;
	} );

	return (
		<>
			<div className="wrap">
				{ currentNotice.message.length > 0 && (
					<Notice
						status={ currentNotice.status ?? 'success' }
						isDismissible
						onRemove={ () =>
							setCurrentNotice( { status: '', message: '' } )
						}
						style={ { marginTop: '16px', marginBottom: '16px' } }
					>
						{ currentNotice.message }
					</Notice>
				) }
				<Card>
					<CardHeader>
						<h2>{ __( 'Upload Private Plugin', 'oneupdate' ) }</h2>
						<Button
							variant="primary"
							onClick={ handleUploadPrivatePlugin }
							disabled={ uploading || ! file }
							style={ {
								width: 'fit-content',
							} }
							isBusy={ uploading }
						>
							{ __( 'Upload & Install Plugin', 'oneupdate' ) }
						</Button>
					</CardHeader>
					<CardBody
						style={ {
							display: 'flex',
							flexDirection: 'column',
							gap: '10px',
						} }
					>
						<div
							className="file-upload-wrapper"
							style={ {
								width: '100%',
								display: 'flex',
								alignItems: 'center',
							} }
						>
							<FormFileUpload
								label={ __(
									'Choose plugin zip file',
									'oneupdate'
								) }
								accept="application/zip"
								onChange={ handleFileChange }
								__nextHasNoMarginBottom
								icon={ upload }
								style={ {
									backgroundColor: '#1c1c1c',
									color: '#fff',
									padding: '10px',
									borderRadius: '4px',
									opacity: uploading ? 0.6 : 1,
									cursor: uploading
										? 'not-allowed'
										: 'pointer',
								} }
								disabled={ uploading }
							>
								{ __( 'Choose plugin zip file', 'oneupdate' ) }
							</FormFileUpload>
							{ file && (
								<div
									style={ {
										marginLeft: '10px',
										color: '#000',
									} }
								>
									{ __( 'Selected file:', 'oneupdate' ) }{ ' ' }
									{ file.name }
								</div>
							) }
						</div>
					</CardBody>
				</Card>

				{ /* Site Selection Modal for Upload */ }
				{ showSiteSelectionModal && (
					<Modal
						title={ __(
							'Select Sites for Plugin Installation',
							'oneupdate'
						) }
						onRequestClose={ () => {
							setShowSiteSelectionModal( false );
						} }
						shouldCloseOnClickOutside={ uploading ? false : true }
						className="oneupdate-site-selection-modal"
						style={ { maxWidth: '600px', minWidth: '600px' } }
					>
						<div style={ { paddingTop: '24px' } }>
							<VStack spacing={ 4 }>
								<div>
									<p
										style={ {
											margin: 0,
											color: '#6c757d',
											fontSize: '14px',
										} }
									>
										{ __(
											'Select the sites where you want to install this plugin.',
											'oneupdate'
										) }
									</p>
								</div>

								{ sharedSites.length > 0 && (
									<div
										style={ {
											marginBottom: '16px',
											display: 'flex',
											flexDirection: 'row',
											gap: '8px',
											alignItems: 'center',
										} }
									>
										<CheckboxControl
											label={ __(
												'Select All Sites',
												'oneupdate'
											) }
											checked={
												selectedSitesForUpload.length ===
												sharedSites.length
											}
											onChange={ () => {
												if (
													selectedSitesForUpload.length ===
													sharedSites.length
												) {
													setSelectedSitesForUpload(
														[]
													);
												} else {
													setSelectedSitesForUpload(
														sharedSites.map(
															( site ) => ( {
																url: site.url,
																name: site.name,
																api_key:
																	site.api_key,
																gh_repo:
																	site.gh_repo,
															} )
														)
													);
												}
											} }
											disabled={ uploading }
											style={ { fontWeight: '500' } }
										/>
										<Button
											variant="link"
											onClick={ () =>
												setSelectedSitesForUpload( [] )
											}
											disabled={
												selectedSitesForUpload.length ===
													0 || uploading
											}
											style={ {
												fontWeight: '500',
												marginBottom: '8px',
											} }
										>
											{ __(
												'Clear Selection',
												'oneupdate'
											) }
										</Button>
									</div>
								) }

								<div>
									{ sharedSites.length > 0 ? (
										<div
											style={ {
												maxHeight: '300px',
												overflowY: 'auto',
												border: '1px solid #e1e5e9',
												borderRadius: '8px',
												padding: '16px',
											} }
										>
											<VStack spacing={ 2 }>
												{ sharedSites.map(
													( site, index ) => (
														<div
															key={ index }
															style={ {
																padding: '8px',
																border: '1px solid #f0f0f1',
																borderRadius:
																	'4px',
																cursor: 'pointer',
															} }
															role="button"
															tabIndex={ 0 }
															onKeyDown={ (
																e
															) => {
																if (
																	uploading
																) {
																	e.preventDefault();
																	return;
																}

																if (
																	e.key ===
																		'Enter' ||
																	e.key ===
																		' '
																) {
																	e.preventDefault();
																	setSelectedSitesForUpload(
																		(
																			prev
																		) =>
																			prev.some(
																				(
																					s
																				) =>
																					s.url ===
																					site.url
																			)
																				? prev.filter(
																						(
																							s
																						) =>
																							s.url !==
																							site.url
																				  )
																				: [
																						...prev,
																						{
																							url: site.url,
																							name: site.name,
																							api_key:
																								site.api_key,
																							gh_repo:
																								site.gh_repo,
																						},
																				  ]
																	);
																}
															} }
															aria-pressed={ selectedSitesForUpload.some(
																( s ) =>
																	s.url ===
																	site.url
															) }
															onClick={ (
																event
															) => {
																event.stopPropagation();

																if (
																	uploading
																) {
																	event.preventDefault();
																	return;
																}

																setSelectedSitesForUpload(
																	( prev ) =>
																		prev.some(
																			(
																				s
																			) =>
																				s.url ===
																				site.url
																		)
																			? prev.filter(
																					(
																						s
																					) =>
																						s.url !==
																						site.url
																			  )
																			: [
																					...prev,
																					{
																						url: site.url,
																						name: site.name,
																						api_key:
																							site.api_key,
																						gh_repo:
																							site.gh_repo,
																					},
																			  ]
																);
															} }
														>
															<CheckboxControl
																className="oneupdate-site-checkbox"
																label={
																	<div>
																		<div
																			style={ {
																				fontWeight:
																					'500',
																				color: '#23282d',
																			} }
																		>
																			{
																				site.name
																			}
																		</div>
																		<div
																			style={ {
																				fontSize:
																					'12px',
																				color: '#6c757d',
																			} }
																		>
																			{
																				site.url
																			}
																		</div>
																	</div>
																}
																checked={ selectedSitesForUpload.some(
																	( s ) =>
																		s.url ===
																		site.url
																) }
																disabled={
																	uploading
																}
															/>
														</div>
													)
												) }
											</VStack>
										</div>
									) : (
										<Notice
											status="warning"
											isDismissible={ false }
										>
											<p style={ { margin: 0 } }>
												{ __(
													'No sites available. Please add sites first.',
													'oneupdate'
												) }
											</p>
										</Notice>
									) }
								</div>

								<HStack justify="flex-end" spacing={ 3 }>
									<Button
										variant="secondary"
										onClick={ () => {
											setShowSiteSelectionModal( false );
											setSelectedSitesForUpload( [] );
										} }
									>
										{ __( 'Cancel', 'oneupdate' ) }
									</Button>
									<Button
										variant="primary"
										onClick={ handleConfirmUpload }
										disabled={
											selectedSitesForUpload.length ===
												0 || uploading
										}
										isBusy={ uploading }
									>
										<Dashicon
											icon="admin-plugins"
											style={ { marginRight: '8px' } }
										/>
										{ uploading
											? __( 'Installing…', 'oneupdate' )
											: __(
													'Install Plugin',
													'oneupdate'
											  ) }
									</Button>
								</HStack>
							</VStack>
						</div>
					</Modal>
				) }

				<Card style={ { marginTop: '20px' } }>
					<CardHeader>
						<h2>{ __( 'Upload History', 'oneupdate' ) }</h2>
						<div className="oneupdate-apply-plugins">
							<Button
								variant="primary"
								onClick={ () =>
									setShowApplyPluginsModal( true )
								}
								style={ { marginTop: '20px' } }
								s
								disabled={
									filteredHistory.length === 0 ||
									loadingHistory ||
									applyingPlugins
								}
								isBusy={ applyingPlugins }
							>
								{ __( 'Install Plugins', 'oneupdate' ) }
							</Button>
						</div>
					</CardHeader>
					<CardBody>
						{ loadingHistory ? (
							<div
								style={ {
									textAlign: 'center',
									padding: '20px',
								} }
							>
								<Spinner
									style={ { width: '40px', height: '40px' } }
								/>
							</div>
						) : (
							<table className="wp-list-table widefat fixed striped">
								<thead>
									<tr>
										<th>
											{ __( 'File Name', 'oneupdate' ) }
										</th>
										<th>
											{ __( 'Upload Time', 'oneupdate' ) }
										</th>
										<th>{ __( 'Action', 'oneupdate' ) }</th>
										<th>{ __( 'Status', 'oneupdate' ) }</th>
									</tr>
								</thead>
								<tbody>
									{ filteredHistory.length === 0 ? (
										<tr>
											<td
												colSpan="4"
												style={ {
													textAlign: 'center',
												} }
											>
												{ __(
													'No uploads yet.',
													'oneupdate'
												) }
											</td>
										</tr>
									) : (
										filteredHistory?.map(
											( item, index ) => (
												<tr key={ index }>
													<td>{ item.file_name }</td>
													<td>
														{ new Date(
															item.upload_time
														).toLocaleString() }
													</td>
													<td>
														<Button
															variant="secondary"
															onClick={ () =>
																handleCopyUrl(
																	item.presigned_url
																)
															}
															disabled={
																new Date(
																	item.upload_time
																).getTime() <
																Date.now() -
																	60 *
																		60 *
																		1000
															}
														>
															{ buttonTexts[
																item
																	.presigned_url
															] ||
																__(
																	'Copy URL',
																	'oneupdate'
																) }
														</Button>
													</td>
													<td
														style={ {
															alignContent:
																'center',
														} }
													>
														{ ( () => {
															const uploadDate =
																new Date(
																	item.upload_time
																);
															const oneHourInMs =
																60 * 60 * 1000;
															const isExpired =
																uploadDate.getTime() <
																Date.now() -
																	oneHourInMs;
															return isExpired ? (
																<span
																	className="status status-error"
																	style={ {
																		color: 'white',
																		padding:
																			'0.5rem',
																		background:
																			'#ff3333',
																		borderRadius:
																			'4px',
																	} }
																>
																	{ __(
																		'Expired',
																		'oneupdate'
																	) }
																</span>
															) : (
																<span
																	className="status status-success"
																	style={ {
																		color: 'white',
																		padding:
																			'0.5rem',
																		background:
																			'#ab3a6c',
																		borderRadius:
																			'4px',
																	} }
																>
																	{ __(
																		'Active',
																		'oneupdate'
																	) }
																</span>
															);
														} )() }
													</td>
												</tr>
											)
										)
									) }
								</tbody>
							</table>
						) }
					</CardBody>
				</Card>

				{ /* Apply Plugins Modal */ }
				{ showApplyPluginsModal && (
					<ApplyPluginsModal
						history={ history }
						setShowApplyPluginsModal={ setShowApplyPluginsModal }
						setCurrentNotice={ setCurrentNotice }
						applyingPlugins={ applyingPlugins }
						setApplyingPlugins={ setApplyingPlugins }
					/>
				) }
			</div>
		</>
	);
};

export default S3ZipUploader;
