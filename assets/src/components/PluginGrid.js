import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button, CheckboxControl, Modal, Spinner, TextControl, Notice } from '@wordpress/components';

import PluginCard from './PluginCard';

const API_NAMESPACE = OneUpdatePlugins.restUrl + '/oneupdate/v1';
const API_KEY = OneUpdatePlugins.api_key;

const PluginGrid = () => {
	const [ page, setPage ] = useState( 1 );
	const [ totalPages, setTotalPages ] = useState( 1 );
	const [ plugins, setPlugins ] = useState( [] );
	const [ selectedPlugin, setSelectedPlugin ] = useState( [] );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ searchInput, setSearchInput ] = useState( '' );
	const [ sharedSites, setSharedSites ] = useState( [] );
	const [ showApplyModal, setShowApplyModal ] = useState( false );
	const [ isNoticeVisible, setIsNoticeVisible ] = useState( false );
	const [ noticeMessage, setNoticeMessage ] = useState( '' );

	const fetchPlugins = useCallback( async () => {
		const encodedQuery = encodeURIComponent( searchQuery );
		const WORDPRESS_PLUGINS_API = `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&search=${ encodedQuery }&per_page=9&page=${ page }&fields=versions`;

		try {
			setLoading( true );
			setError( null );

			const response = await fetch( WORDPRESS_PLUGINS_API );
			if ( ! response.ok ) {
				throw new Error( __( 'Failed to fetch plugins.', 'oneupdate' ) );
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
		fetchPlugins();
	}, [ fetchPlugins ] );

	const handleRetry = () => fetchPlugins();

	const handlePluginSelect = ( slug, version ) => {
		setSelectedPlugin( ( prev ) => {
			if ( ! version ) {
				return prev.filter( ( p ) => p.slug !== slug );
			}
			const existing = prev.find( ( p ) => p.slug === slug );
			if ( existing ) {
				return prev.map( ( p ) =>
					p.slug === slug ? { ...p, version } : p,
				);
			}
			return [ ...prev, { slug, version } ];
		} );
	};

	const handleVersionChange = ( slug, version ) => {
		setSelectedPlugin( ( prev ) =>
			prev.map( ( p ) =>
				p.slug === slug ? { ...p, version } : p,
			),
		);
	};

	const fetchSharedSitesData = useCallback( async () => {
		const response = await fetch(
			`${ API_NAMESPACE }/shared-sites`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-ONEUPDATE-TOKEN': API_KEY,
				},
			},
		);
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

	const handleSearchSubmit = () => {
		setPage( 1 );
		setSearchQuery( searchInput );
	};

	const selectedCount = selectedPlugin?.length || 0;

	return (
		<div className="oneupdate-plugin-container">

			{ /* Notice State */ }
			{ isNoticeVisible && (
				<Notice
					status={ noticeMessage.type }
					isDismissible={ true }
				>
					{ noticeMessage.message }
				</Notice>
			) }

			{ /* Search Bar */ }
			<div className="oneupdate-search-container"
				style={
					{
						marginBottom: '1em',
						display: 'flex',
						flexDirection: 'row',
						alignItems: 'baseline',
						justifyContent: 'flex-end',
						gap: '1em',
					}
				}
			>
				<TextControl
					placeholder={ __( 'Search plugins…', 'oneupdate' ) }
					value={ searchInput }
					onChange={ setSearchInput }
					onKeyDown={ ( e ) => {
						if ( e.key === 'Enter' ) {
							handleSearchSubmit();
						}
					} }
				/>
				<Button
					variant="primary"
					onClick={ handleSearchSubmit }
				>
					{ __( 'Search', 'oneupdate' ) }
				</Button>
			</div>

			{ /* Loading State */ }
			{ loading && (
				<div className="oneupdate-loading-container">
					<Spinner style={ { width: '40px', height: '40px' } } />
					<p className="loading-text">{ __( 'Loading plugins…', 'oneupdate' ) }</p>
				</div>
			) }

			{ /* Error State */ }
			{ ! loading && error && (
				<div className="oneupdate-error-container">
					<div className="error-content">
						<h3>{ __( 'Unable to load plugins', 'oneupdate' ) }</h3>
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
			{ ! loading && ! error && plugins.length === 0 && (
				<div className="oneupdate-empty-container">
					<div className="empty-content">
						<h3>{ __( 'No plugins found', 'oneupdate' ) }</h3>
						<p>{ __( 'Unable to find any plugins to display.', 'oneupdate' ) }</p>
						<Button
							variant="secondary"
							onClick={ handleRetry }
						>
							{ __( 'Refresh', 'oneupdate' ) }
						</Button>
					</div>
				</div>
			) }

			{ /* Success State */ }
			{ ! loading && ! error && plugins.length > 0 && (
				<>
					{ selectedCount > 0 && (
						<div className="selection-summary">
							<div className="selection-info">
								<span className="selection-count">
									{ selectedCount }{ ' ' }
									{ selectedCount === 1
										? __( 'plugin', 'oneupdate' )
										: __( 'plugins', 'oneupdate' ) }{ ' ' }
									{ __( 'selected', 'oneupdate' ) }
								</span>
								<Button
									variant="primary"
									disabled={ selectedCount === 0 }
									aria-label={ __( 'Apply selected plugins', 'oneupdate' ) }
									onClick={ () => setShowApplyModal( true ) }
								>
									{ __( 'Apply Selected plugins', 'oneupdate' ) }
								</Button>
							</div>
						</div>
					) }

					{ showApplyModal && (
						<ApplyPluginsModal
							sharedSites={ sharedSites }
							selectedPlugin={ selectedPlugin }
							setShowApplyModal={ setShowApplyModal }
							setNoticeMessage={ setNoticeMessage }
							setIsNoticeVisible={ setIsNoticeVisible }
							setSelectedPlugin={ setSelectedPlugin }
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

					<div className="oneupdate-pagination">
						<Button
							disabled={ page <= 1 }
							onClick={ () => setPage( ( prev ) => Math.max( prev - 1, 1 ) ) }
							variant="secondary"
						>
							{ __( 'Previous', 'oneupdate' ) }
						</Button>
						<span className="page-info">
							{ __( 'Page', 'oneupdate' ) } { page } { __( 'of', 'oneupdate' ) } { totalPages }
						</span>
						<Button
							disabled={ page >= totalPages }
							onClick={ () => setPage( ( prev ) => Math.min( prev + 1, totalPages ) ) }
							variant="secondary"
						>
							{ __( 'Next', 'oneupdate' ) }
						</Button>
					</div>
				</>
			) }
		</div>

	);
};

const ApplyPluginsModal = ( { sharedSites, selectedPlugin, setShowApplyModal, setNoticeMessage, setIsNoticeVisible, setSelectedPlugin } ) => {
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
			selectedSite.includes( site.url ),
		);

		setSelectedSiteInfo( selectedSiteFullInfo );
	}, [ selectedSite, sharedSites ] );

	const handleApplyPlugins = async () => {
		try {
			const response = await fetch(
				`${ API_NAMESPACE }/apply-plugins`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-ONEUPDATE-TOKEN': API_KEY,
					},
					body: JSON.stringify( {
						sites: selectedSiteInfo,
						plugins: selectedPlugin,
					} ),
				},
			);
			const data = await response.json();
			if ( data?.success && data?.created_prs ) {
				const prUrls = data?.created_prs;
				const prUrlsArray = prUrls?.map( ( pr ) => {
					return pr?.data?.pr_url || '';
				} ).filter( ( url ) => url !== '' ) || [];

				// Join to comma separated string
				const prUrlsString = prUrlsArray.join( ', ' );

				setIsNoticeVisible( true );
				setNoticeMessage( {
					type: 'success',
					message: __( 'Plugins applied successfully. Please check the PR at:', 'oneupdate' ) + ` ${ prUrlsString }`,
				} );
				setSelectedPlugin( [] );
			} else {
				setIsNoticeVisible( true );
				setNoticeMessage( {
					type: 'error',
					message: __( 'Failed to apply plugins. Please try again.', 'oneupdate' ),
				} );
			}
		} catch ( error ) {
			setIsNoticeVisible( true );
			setNoticeMessage( {
				type: 'error',
				message: __( 'An error occurred while applying plugins.', 'oneupdate' ),
			} );
		}
	};

	return (
		<Modal
			title={ __( 'Apply Selected Plugins', 'oneupdate' ) }
			isOpen={ true }
			shouldCloseOnClickOutside={ true }
			className="oneupdate-apply-plugins-modal"
		>
			<div className="oneupdate-modal-content">
				<h3>{ __( 'Select a site to apply the plugins', 'oneupdate' ) }</h3>
				{ sharedSites.length > 0 ? (
					<div className="oneupdate-site-selection">
						{ sharedSites.map( ( site ) => (
							<CheckboxControl
								key={ site?.url }
								label={ site?.name }
								checked={ selectedSite.includes( site?.url ) }
								onChange={ () => handleSiteSelection( site.url ) }
							/>
						) ) }
					</div>
				) : (
					<p>{ __( 'No sites available to apply plugins.', 'oneupdate' ) }</p>
				) }
				<Button
					variant="primary"
					onClick={ () => {
						handleApplyPlugins();
						setSelectedSite( [] );
						setShowApplyModal( false );
					} }
					disabled={ ! selectedSite }
				>
					{ __( 'Apply Plugins', 'oneupdate' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default PluginGrid;