/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Button,
	SelectControl,
	Spinner,
	TextControl,
	Modal,
	Dashicon,
	CheckboxControl,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
	Notice,
} from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';

const API_NAMESPACE = window.OneUpdatePlugins.restUrl + '/oneupdate/v1';
const RestNonce = window.OneUpdatePlugins.restNonce;

const PluginCard = ( {
	plugin,
	selectedPlugin,
	onSelect,
	onVersionChange,
} ) => {
	const {
		name,
		slug,
		version,
		short_description: shortDescription,
		versions,
		author,
	} = plugin;

	const selectedEntry = selectedPlugin?.find( ( p ) => p.slug === slug );
	const isSelected = !! selectedEntry;
	const selectedVersion = selectedEntry?.version || version;

	const handlePluginToggle = () => {
		if ( isSelected ) {
			onSelect( slug, null ); // deselect
		} else {
			onSelect( slug, selectedVersion ); // select with current version
		}
	};

	const handleVersionChange = ( newVersion ) => {
		onVersionChange( slug, newVersion );
	};

	return (
		<div
			className={ `oneupdate-plugin-card ${
				isSelected ? 'selected' : ''
			}` }
			key={ slug }
		>
			<div className="plugin-card-header">
				<div className="plugin-icon-wrapper">
					<img
						src={
							plugin?.icons?.[ '1x' ] || plugin?.icons?.default
						}
						alt={ decodeEntities( name ) }
						className="plugin-card-logo"
						loading="lazy"
					/>
				</div>
				<div className="plugin-card-header-text">
					<h3
						className="plugin-name"
						title={ decodeEntities( name ) }
					>
						{ decodeEntities( name ) }
					</h3>
					<div className="plugin-author">
						<span
							className="author-label"
							style={ { marginRight: '4px' } }
						>
							{ __( 'By', 'oneupdate' ) }
						</span>
						<span
							className="author-name"
							dangerouslySetInnerHTML={ { __html: author } }
						></span>
					</div>
					<div className="plugin-version-badge">
						<span className="version-label">
							{ __( 'Latest', 'oneupdate' ) }
						</span>
						<span className="version-number">
							{ __( 'v', 'oneupdate' ) }
							{ version }
						</span>
					</div>
				</div>
			</div>

			<div className="plugin-card-body">
				<p className="plugin-description">
					{ decodeEntities( shortDescription ) }
				</p>
			</div>

			<div className="plugin-card-footer">
				<Button
					className={ `plugin-select-btn ${
						isSelected ? 'selected' : ''
					}` }
					variant={ isSelected ? 'primary' : 'secondary' }
					onClick={ handlePluginToggle }
				>
					<span className="btn-text">
						{ isSelected
							? __( 'Selected', 'oneupdate' )
							: __( 'Select Plugin', 'oneupdate' ) }
					</span>
				</Button>
				{ isSelected && (
					<PluginVersionSelectControl
						versions={ versions }
						selectedVersion={ selectedVersion }
						onChange={ handleVersionChange }
					/>
				) }
			</div>
		</div>
	);
};

const PluginVersionSelectControl = ( {
	versions,
	selectedVersion,
	onChange,
} ) => {
	const getLastFiveVersions = ( versionsObj ) => {
		if ( ! versionsObj || typeof versionsObj !== 'object' ) {
			return [];
		}

		const versionKeys = Object.keys( versionsObj ).filter(
			( key ) => key !== 'trunk' && ! /(alpha|beta|rc|dev|a)/i.test( key )
		);

		const sortedVersions = versionKeys.sort( ( a, b ) => {
			const aParts = a
				.split( '.' )
				.map( ( part ) => parseInt( part, 10 ) || 0 );
			const bParts = b
				.split( '.' )
				.map( ( part ) => parseInt( part, 10 ) || 0 );

			const maxLength = Math.max( aParts.length, bParts.length );
			for ( let i = 0; i < maxLength; i++ ) {
				if ( aParts[ i ] < bParts[ i ] ) {
					return -1;
				}
				if ( aParts[ i ] > bParts[ i ] ) {
					return 1;
				}
			}
			return 0;
		} );

		return sortedVersions.slice( -5 ).reverse();
	};

	const lastFiveVersions = getLastFiveVersions( versions );

	if ( ! lastFiveVersions.length ) {
		return null;
	}

	return (
		<div className="version-select-wrapper">
			<SelectControl
				className="version-select"
				label={ __( 'Version', 'oneupdate' ) }
				value={ selectedVersion }
				options={ lastFiveVersions.map( ( v ) => ( {
					label: `v${ v }`,
					value: v,
				} ) ) }
				onChange={ onChange }
				hideLabelFromVision={ false }
			/>
		</div>
	);
};

const SearchSection = ( {
	searchInput,
	setSearchInput,
	onSearch,
	hasSearched,
} ) => {
	return (
		<div className="oneupdate-search-section">
			<div className="search-hero">
				<h2 className="search-title">
					{ __( 'Search & Share WordPress Plugins', 'oneupdate' ) }
				</h2>
				<p className="search-subtitle">
					{ __(
						'Find and install plugins across all your connected sites',
						'oneupdate'
					) }
				</p>
			</div>

			<div className="oneupdate-search-container">
				<div
					className="search-input-wrapper"
					style={ {
						display: 'flex',
						flexDirection: 'row',
						gap: '1rem',
					} }
				>
					<TextControl
						className="search-input-large"
						placeholder={ __(
							'Search for plugins (e.g., "contact form", "SEO", "security")…',
							'oneupdate'
						) }
						value={ searchInput }
						onChange={ setSearchInput }
						onKeyDown={ ( e ) => {
							if ( e.key === 'Enter' ) {
								onSearch();
							}
						} }
						style={ {
							height: '36px',
							width: '30vw',
						} }
					/>
					<Button
						className="search-button-large"
						variant="primary"
						onClick={ onSearch }
						disabled={ ! searchInput.trim() }
					>
						{ __( 'Search Plugins', 'oneupdate' ) }
					</Button>
				</div>
				{ ! hasSearched && (
					<div className="search-tips">
						<p className="search-tip-text">
							{ __(
								'💡 Tip: Try searching for specific functionality like "backup", "analytics", or "forms"',
								'oneupdate'
							) }
						</p>
					</div>
				) }
			</div>
		</div>
	);
};

const PluginGrid = () => {
	const [ page, setPage ] = useState( 1 );
	const [ totalPages, setTotalPages ] = useState( 1 );
	const [ plugins, setPlugins ] = useState( [] );
	const [ selectedPlugin, setSelectedPlugin ] = useState( [] );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ searchInput, setSearchInput ] = useState( '' );
	const [ hasSearched, setHasSearched ] = useState( false );
	const [ sharedSites, setSharedSites ] = useState( [] );
	const [ showApplyModal, setShowApplyModal ] = useState( false );
	const [ isNoticeVisible, setIsNoticeVisible ] = useState( false );
	const [ noticeMessage, setNoticeMessage ] = useState( '' );
	const [ pluginType, setPluginType ] = useState( 'add_update' );
	const [ showPluginTypeModal, setShowPluginTypeModal ] = useState( false );
	const [ isApplyingPlugins, setIsApplyingPlugins ] = useState( false );

	const fetchPlugins = useCallback( async () => {
		if ( ! searchQuery.trim() ) {
			return;
		}

		const encodedQuery = encodeURIComponent( searchQuery );
		const WORDPRESS_PLUGINS_API = `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&search=${ encodedQuery }&per_page=9&page=${ page }&fields=versions`;

		try {
			setLoading( true );
			setError( null );

			const response = await fetch( WORDPRESS_PLUGINS_API );
			if ( ! response.ok ) {
				throw new Error(
					__( 'Failed to fetch plugins.', 'oneupdate' )
				);
			}

			const data = await response.json();
			setPlugins( data?.plugins || [] );
			setTotalPages( data?.info?.pages || 1 );
			setPage( data?.info?.page || 1 );
		} catch ( e ) {
			setError( e.message );
		} finally {
			setLoading( false );
		}
	}, [ page, searchQuery ] );

	useEffect( () => {
		if ( searchQuery ) {
			fetchPlugins();
		}
	}, [ fetchPlugins, searchQuery ] );

	const handleRetry = () => fetchPlugins();

	const handlePluginSelect = ( slug, version ) => {
		setSelectedPlugin( ( prev ) => {
			if ( ! version ) {
				return prev.filter( ( p ) => p.slug !== slug );
			}
			const existing = prev.find( ( p ) => p.slug === slug );
			if ( existing ) {
				return prev.map( ( p ) =>
					p.slug === slug ? { ...p, version } : p
				);
			}
			return [ ...prev, { slug, version } ];
		} );
	};

	const handleVersionChange = ( slug, version ) => {
		setSelectedPlugin( ( prev ) =>
			prev.map( ( p ) => ( p.slug === slug ? { ...p, version } : p ) )
		);
	};

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
	}, [ fetchSharedSitesData ] );

	const handleSearchSubmit = () => {
		if ( ! searchInput.trim() ) {
			return;
		}
		setPage( 1 );
		setSearchQuery( searchInput );
		setHasSearched( true );
	};

	const selectedCount = selectedPlugin?.length || 0;

	return (
		<div className="oneupdate-plugin-container">
			{ /* Notice State */ }
			{ isNoticeVisible && (
				<Notice
					status={ noticeMessage.type }
					isDismissible
					onRemove={ () => setIsNoticeVisible( false ) }
				>
					{ noticeMessage.message }
				</Notice>
			) }

			{ /* Search Section - Always visible and prominent */ }
			<SearchSection
				searchInput={ searchInput }
				setSearchInput={ setSearchInput }
				onSearch={ handleSearchSubmit }
				hasSearched={ hasSearched }
			/>

			{ /* Show content only after search */ }
			{ hasSearched && (
				<>
					{ /* Loading State */ }
					{ loading && (
						<div className="oneupdate-loading-container">
							<Spinner
								style={ { width: '40px', height: '40px' } }
							/>
							<p className="loading-text">
								{ __( 'Searching plugins…', 'oneupdate' ) }
							</p>
						</div>
					) }

					{ /* Error State */ }
					{ ! loading && error && (
						<div className="oneupdate-error-container">
							<div className="error-content">
								<h3>
									{ __(
										'Unable to load plugins',
										'oneupdate'
									) }
								</h3>
								<p>{ error }</p>
								<Button
									variant="primary"
									onClick={ handleRetry }
								>
									{ __( 'Try Again', 'oneupdate' ) }
								</Button>
							</div>
						</div>
					) }

					{ /* Empty State */ }
					{ ! loading &&
						! error &&
						plugins.length === 0 &&
						searchQuery && (
							<div className="oneupdate-empty-container">
								<div className="empty-content">
									<h3>
										{ __(
											'No plugins found',
											'oneupdate'
										) }
									</h3>
									<p>
										{ __(
											'No plugins found for',
											'oneupdate'
										) }{ ' ' }
										&quot;<strong>{ searchQuery }</strong>
										&quot;.
										{ __(
											'Try different keywords or check your spelling.',
											'oneupdate'
										) }
									</p>
									<Button
										variant="secondary"
										onClick={ () => setSearchInput( '' ) }
									>
										{ __( 'Clear Search', 'oneupdate' ) }
									</Button>
								</div>
							</div>
						) }

					{ /* Success State */ }
					{ ! loading && ! error && plugins.length > 0 && (
						<>
							<div className="search-results-header">
								<h3 className="results-title">
									{ __( 'Search Results for', 'oneupdate' ) }{ ' ' }
									&quot;{ searchQuery }&quot;
								</h3>
							</div>

							{ selectedCount > 0 && (
								<div className="selection-summary">
									<div className="selection-info">
										<span className="selection-count">
											{ selectedCount }{ ' ' }
											{ selectedCount === 1
												? __( 'plugin', 'oneupdate' )
												: __(
														'plugins',
														'oneupdate'
												  ) }{ ' ' }
											{ __( 'selected', 'oneupdate' ) }
										</span>
										<Button
											variant="primary"
											disabled={
												selectedCount === 0 ||
												isApplyingPlugins
											}
											aria-label={ __(
												'Install Selected Plugins',
												'oneupdate'
											) }
											onClick={ () =>
												setShowApplyModal( true )
											}
											isBusy={ isApplyingPlugins }
										>
											{ __(
												'Install Selected Plugins',
												'oneupdate'
											) }
										</Button>
									</div>
								</div>
							) }

							{ showPluginTypeModal && (
								<PluginTypeSelectionModal
									pluginType={ pluginType }
									setPluginType={ setPluginType }
									setShowPluginTypeModal={
										setShowPluginTypeModal
									}
									setShowApplyModal={ setShowApplyModal }
								/>
							) }

							{ showApplyModal && (
								<ApplyPluginsModal
									sharedSites={ sharedSites }
									selectedPlugin={ selectedPlugin }
									setShowApplyModal={ setShowApplyModal }
									setNoticeMessage={ setNoticeMessage }
									setIsNoticeVisible={ setIsNoticeVisible }
									setSelectedPlugin={ setSelectedPlugin }
									pluginType={ pluginType }
									isApplyingPlugins={ isApplyingPlugins }
									setIsApplyingPlugins={
										setIsApplyingPlugins
									}
								/>
							) }

							<div className="oneupdate-plugin-grid">
								{ plugins.map( ( plugin ) => (
									<PluginCard
										id={ plugin.slug }
										key={ plugin.slug }
										plugin={ plugin }
										selectedPlugin={ selectedPlugin }
										setSelectedPlugin={ setSelectedPlugin }
										onSelect={ handlePluginSelect }
										onVersionChange={ handleVersionChange }
									/>
								) ) }
							</div>

							{ totalPages > 1 && (
								<div className="oneupdate-pagination">
									<Button
										disabled={ page <= 1 }
										onClick={ () =>
											setPage( ( prev ) =>
												Math.max( prev - 1, 1 )
											)
										}
										variant="secondary"
									>
										{ __( 'Previous', 'oneupdate' ) }
									</Button>
									<span className="page-info">
										{ __( 'Page', 'oneupdate' ) } { page }{ ' ' }
										{ __( 'of', 'oneupdate' ) }{ ' ' }
										{ totalPages }
									</span>
									<Button
										disabled={ page >= totalPages }
										onClick={ () =>
											setPage( ( prev ) =>
												Math.min( prev + 1, totalPages )
											)
										}
										variant="secondary"
									>
										{ __( 'Next', 'oneupdate' ) }
									</Button>
								</div>
							) }
						</>
					) }
				</>
			) }
		</div>
	);
};

const PluginTypeSelectionModal = ( {
	pluginType,
	setPluginType,
	setShowPluginTypeModal,
	setShowApplyModal,
} ) => {
	return (
		<Modal
			title={ __( 'Select Plugin Apply Type', 'oneupdate' ) }
			onRequestClose={ () => setShowPluginTypeModal( false ) }
			shouldCloseOnClickOutside
			className="oneupdate-plugin-type-modal"
		>
			<div className="oneupdate-modal-content">
				<SelectControl
					value={ pluginType }
					options={ [
						{
							label: __( 'Add/Update', 'oneupdate' ),
							value: 'add_update',
						},
						{
							label: __( 'Activate', 'oneupdate' ),
							value: 'activate',
						},
						{
							label: __( 'Deactivate', 'oneupdate' ),
							value: 'deactivate',
						},
						{ label: __( 'Remove', 'oneupdate' ), value: 'remove' },
					] }
					onChange={ ( value ) => {
						setPluginType( value );
					} }
					hideLabelFromVision={ false }
				/>
				<div className="modal-actions">
					<Button
						variant="secondary"
						onClick={ () => setShowPluginTypeModal( false ) }
						style={ { marginRight: '1rem' } }
					>
						{ __( 'Cancel', 'oneupdate' ) }
					</Button>
					<Button
						variant="primary"
						onClick={ () => setShowApplyModal( true ) }
					>
						{ __( 'Next', 'oneupdate' ) }
					</Button>
				</div>
			</div>
		</Modal>
	);
};

const ApplyPluginsModal = ( {
	sharedSites,
	selectedPlugin,
	setShowApplyModal,
	setNoticeMessage,
	setIsNoticeVisible,
	setSelectedPlugin,
	pluginType,
	isApplyingPlugins,
	setIsApplyingPlugins,
} ) => {
	const [ selectedSite, setSelectedSite ] = useState( [] );
	const [ selectedSiteInfo, setSelectedSiteInfo ] = useState( [] );

	const handleSiteSelection = ( url ) => {
		// Deselect if already selected else add to selected sites list
		setSelectedSite( ( prev ) => {
			if ( prev.includes( url ) ) {
				return prev.filter( ( id ) => id !== url );
			}
			return [ ...prev, url ];
		} );
	};

	// based on selected sites need to get all info from sharedsites for all selected sites
	useEffect( () => {
		const selectedSiteFullInfo = sharedSites.filter( ( site ) =>
			selectedSite.includes( site.url )
		);

		setSelectedSiteInfo( selectedSiteFullInfo );
	}, [ selectedSite, sharedSites ] );

	const handleApplyPlugins = async () => {
		setIsApplyingPlugins( true );
		try {
			const response = await fetch( `${ API_NAMESPACE }/apply-plugins`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': RestNonce,
				},
				body: JSON.stringify( {
					sites: selectedSiteInfo,
					plugins: selectedPlugin,
					plugin_type: pluginType,
				} ),
			} );
			const data = await response.json();
			if ( data?.success && data?.created_prs ) {
				// Group results by site name and format message
				let noticeMessage = __(
					'Plugins applied successfully.',
					'oneupdate'
				);

				if (
					data.created_prs &&
					Array.isArray( data.created_prs ) &&
					data.created_prs.length > 0
				) {
					// Group actions by site name
					const groupedBySite = data.created_prs.reduce(
						( acc, pr ) => {
							const name = pr.name || 'Unknown Site';
							if ( ! acc[ name ] ) {
								acc[ name ] = [];
							}
							acc[ name ].push( pr );
							return acc;
						},
						{}
					);

					// Format the message with site names and their respective URLs (each URL on new line)
					const siteGroups = Object.entries( groupedBySite ).map(
						( [ name, prs ] ) => {
							const actionLinks = prs
								.map( ( pr ) => pr.run_url )
								.join( '\n' );
							return `${ name }\n${ actionLinks }`;
						}
					);

					noticeMessage += `\n\n${ siteGroups.join( '\n\n' ) }`;
				}

				setIsNoticeVisible( true );
				setNoticeMessage( {
					type: 'success',
					message: noticeMessage,
				} );
				setSelectedPlugin( [] );
			} else {
				setIsNoticeVisible( true );
				setNoticeMessage( {
					type: 'error',
					message: __(
						'Failed to apply plugins. Please try again.',
						'oneupdate'
					),
				} );
			}
		} catch {
			setIsNoticeVisible( true );
			setNoticeMessage( {
				type: 'error',
				message: __(
					'An error occurred while applying plugins.',
					'oneupdate'
				),
			} );
		} finally {
			setSelectedSite( [] );
			setShowApplyModal( false );
			setIsApplyingPlugins( false );
		}
	};

	return (
		<Modal
			title={ __( 'Install Selected Plugins', 'oneupdate' ) }
			onRequestClose={ () => setShowApplyModal( false ) }
			shouldCloseOnClickOutside={ isApplyingPlugins ? false : true }
			className="oneupdate-apply-plugins-modal"
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
								'Select the sites where you want to install the selected plugins.',
								'oneupdate'
							) }
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
											selectedSite.length ===
											sharedSites.length
										}
										onChange={ () => {
											if (
												selectedSite.length ===
												sharedSites.length
											) {
												setSelectedSite( [] );
											} else {
												setSelectedSite(
													sharedSites.map(
														( site ) => site.url
													)
												);
											}
										} }
										disabled={ isApplyingPlugins }
										style={ { fontWeight: '500' } }
									/>
									<Button
										variant="link"
										onClick={ () => setSelectedSite( [] ) }
										disabled={
											selectedSite.length === 0 ||
											isApplyingPlugins
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
										{ sharedSites.map( ( site ) => (
											<div
												key={ site?.url }
												style={ {
													padding: '8px',
													border: '1px solid #f0f0f1',
													borderRadius: '4px',
													cursor: 'pointer',
												} }
												onClick={ ( event ) => {
													event.stopPropagation();

													if ( isApplyingPlugins ) {
														event.preventDefault();
														return;
													}

													handleSiteSelection(
														site.url
													);
												} }
												role="button"
												tabIndex={ 0 }
												onKeyDown={ ( e ) => {
													if ( isApplyingPlugins ) {
														e.preventDefault();
														return;
													}

													if (
														e.key === 'Enter' ||
														e.key === ' '
													) {
														e.preventDefault();
														handleSiteSelection(
															site.url
														);
													}
												} }
												aria-pressed={ selectedSite.includes(
													site.url
												) }
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
																{ site?.name }
															</div>
															<div
																style={ {
																	fontSize:
																		'12px',
																	color: '#6c757d',
																} }
															>
																{ site?.url }
															</div>
														</div>
													}
													checked={ selectedSite.includes(
														site?.url
													) }
													onChange={ () =>
														handleSiteSelection(
															site.url
														)
													}
													disabled={
														isApplyingPlugins
													}
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
										'No sites available to apply plugins.',
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
							onClick={ () => setShowApplyModal( false ) }
							disabled={ isApplyingPlugins }
						>
							{ __( 'Cancel', 'oneupdate' ) }
						</Button>
						<Button
							variant="primary"
							onClick={ () => {
								handleApplyPlugins();
							} }
							disabled={
								selectedSite.length === 0 || isApplyingPlugins
							}
							isBusy={ isApplyingPlugins }
						>
							<Dashicon
								icon="admin-plugins"
								style={ { marginRight: '8px' } }
							/>
							{ isApplyingPlugins
								? __( 'Installing…', 'oneupdate' )
								: __( 'Install Plugins', 'oneupdate' ) }
						</Button>
					</HStack>
				</VStack>
			</div>
		</Modal>
	);
};

const PluginsSharing = () => {
	return (
		<div className="oneupdate-plugin-sharing-app">
			<PluginGrid />
		</div>
	);
};

export default PluginsSharing;
