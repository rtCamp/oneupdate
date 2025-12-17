/**
 * WordPress dependencies
 */
import { createRoot, useCallback, useState, useEffect, useMemo } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	SelectControl,
	Spinner,
	TextControl,
	Card,
	CardBody,
	Flex,
	FlexBlock,
	FlexItem,
	Modal,
	__experimentalGrid as Grid,
	Dashicon,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	__experimentalSpacer as Spacer,
	Tooltip,
	CheckboxControl,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
	Notice,
	Snackbar,
} from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import { arrowLeft, plus, loop } from '@wordpress/icons';
import PluginsSharing from '../../components/PluginsSharing';
import S3ZipUploader from '../../components/S3ZipUploader';
import { PurifyElement } from '../../js/utils';

// Declare the OneUpdatePlugins variable
const OneUpdatePlugins = window.OneUpdatePlugins || {};
const API_NAMESPACE = OneUpdatePlugins.restUrl + '/oneupdate/v1';
const RestNonce = OneUpdatePlugins.restNonce;

const PluginManager = () => {
	const [ combinedPluginsBySlug, setCombinedPluginsBySlug ] = useState( {} );
	const [ loading, setLoading ] = useState( true );
	const [ loadingProgress, setLoadingProgress ] = useState( { current: 0, total: 0, message: '' } );

	// Filter states
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ statusFilter, setStatusFilter ] = useState( 'all' );
	const [ typeFilter, setTypeFilter ] = useState( 'all' );
	const [ updateFilter, setUpdateFilter ] = useState( 'all' );
	const [ siteFilter, setSiteFilter ] = useState( 'all' );

	// Modal states
	const [ selectedPlugin, setSelectedPlugin ] = useState( null );
	const [ showPluginModal, setShowPluginModal ] = useState( false );
	const [ showSitesModal, setShowSitesModal ] = useState( false );
	const [ showSiteSelectionModal, setShowSiteSelectionModal ] = useState( false );
	const [ currentAction, setCurrentAction ] = useState( null ); // 'activate', 'deactivate', 'update', 'change-version', 'remove'
	const [ selectedSites, setSelectedSites ] = useState( [] );
	const [ selectedVersion, setSelectedVersion ] = useState( '' );
	const [ actionLoading, setActionLoading ] = useState( false );
	const [ isBulkUpdateProcess, setIsBulkUpdateProcess ] = useState( false );
	const [ allAvailableSites, setAllAvailableSites ] = useState( [] );
	const [ isValidS3Credentials, setIsValidS3Credentials ] = useState( false );

	// add plugin state
	const [ showAddPluginModal, setShowAddPluginModal ] = useState( false );
	const [ showBackButton, setShowBackButton ] = useState( false );
	const [ addPluginType, setAddPluginType ] = useState( '' ); // 'public' or 'private'

	// global notice state
	const [ globalNotice, setGlobalNotice ] = useState( {} );

	const performHealthCheckOnS3Credentials = useCallback( async () => {
		try {
			const response = await fetch(
				`${ API_NAMESPACE }/s3-health-check`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-NONCE': RestNonce,
					},
				},
			);
			if ( ! response.ok ) {
				throw new Error( __( 'Failed to perform S3 health check.', 'oneupdate' ) );
			}
			const data = await response.json();
			if ( data?.status === 'success' ) {
				setIsValidS3Credentials( true );
			} else {
				setIsValidS3Credentials( false );
			}
		} catch ( error ) {
			setIsValidS3Credentials( false );
		}
	}, [] );

	useEffect( () => {
		performHealthCheckOnS3Credentials();
	}, [] );

	const fetchSitesWithPluginLoader = useCallback( async () => {
		try {
			const response = await fetch( `${ API_NAMESPACE }/shared-sites?time=${ new Date().toISOString() }`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': RestNonce,
				},
			} );

			if ( ! response.ok ) {
				throw new Error( __( 'Failed to fetch sites data.', 'oneupdate' ) );
			}

			const data = await response.json();
			setAllAvailableSites( data.shared_sites || [] ); // Store all available sites for later use
			return data.success ? data.shared_sites : [];
		} catch ( error ) {
			return [];
		}
	}, [] );

	const fetchPluginsFromSite = useCallback( async ( site ) => {
		try {
			const response = await fetch( site.url + `wp-json/oneupdate/v1/get_plugins?time=${ new Date().toISOString() }`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-OneUpdate-Token': site.api_key || '',
				},
				'cache-control': 'no-cache, no-store, must-revalidate',
			} );

			if ( ! response.ok ) {
				throw new Error( sprintf( 'Failed to fetch plugins from site: %s', site.name ) );
			}

			const data = await response.json();
			return data.success ? data.plugins : {};
		} catch ( error ) {
			return {};
		}
	}, [] );

	const transformRealTimePluginsData = useCallback( ( sharedPluginsData, sitePluginsData, allSites ) => {
		const transformedPlugins = {};

		// First, collect all unique plugins from all sites
		const allPluginSlugs = new Set();

		// Add plugins from shared data
		if ( sharedPluginsData && typeof sharedPluginsData === 'object' ) {
			Object?.keys( sharedPluginsData )?.forEach( ( slug ) => allPluginSlugs?.add( slug ) );

			// Add plugins found on sites
		}
		if ( sitePluginsData && typeof sitePluginsData === 'object' ) {
			// Iterate through each site's plugins
			Object?.values( sitePluginsData )?.forEach( ( { plugins } ) => {
				Object?.values( plugins )?.forEach( ( plugin ) => {
					if ( plugin.plugin_slug ) {
						allPluginSlugs?.add( plugin.plugin_slug );
					}
				} );
			} );
		}

		// Process each unique plugin
		allPluginSlugs.forEach( ( slug ) => {
			const sharedPluginData = sharedPluginsData?.[ slug ] || {};
			const sites = {};

			let totalSites = 0;
			let activeSites = 0;
			let updateAvailableSites = 0;

			// Check real plugin status on each site
			Object.entries( sitePluginsData ).forEach( ( [ url, { site, plugins } ] ) => {
				// Find this plugin on the current site
				const sitePlugin = Object.values( plugins ).find( ( p ) => p.plugin_slug === slug );

				if ( sitePlugin ) {
					const isActive = sitePlugin.is_active || false;
					const currentVersion = sitePlugin.Version || sitePlugin.version || '0.0.0';
					const hasUpdate = sitePlugin.is_update_available || false;

					sites[ url ] = {
						plugin_path: `${ slug }/${ slug }.php`,
						version: currentVersion,
						is_active: isActive,
						is_update_available: hasUpdate,
						update_info: hasUpdate && sitePlugin.update ? sitePlugin.update : null,
						site_name: site.name,
						site_id: site.id,
						plugin_data: sitePlugin, // Keep full plugin data for modal
					};

					totalSites++;
					if ( isActive ) {
						activeSites++;
					}
					if ( hasUpdate ) {
						updateAvailableSites++;
					}
				} else if ( sharedPluginData.sites && sharedPluginData.sites[ site.id ] ) {
					// Plugin exists in shared data but not found on site (might be inactive/uninstalled)
					sites[ url ] = {
						plugin_path: `${ slug }/${ slug }.php`,
						version: sharedPluginData.version || '0.0.0',
						is_active: false,
						is_update_available: false,
						update_info: null,
						site_name: site.name,
						site_id: site.id,
						plugin_data: null,
					};
					totalSites++;
				}
			} );

			// Only include plugins that exist on at least one site
			if ( totalSites > 0 ) {
				// Get the most complete plugin info available
				const sampleSitePlugin = Object.values( sites ).find( ( s ) => s.plugin_data )?.plugin_data;
				let pluginInfo = ( sharedPluginData.is_public !== undefined && sharedPluginData.is_public === true && sharedPluginData.plugin_info.versions !== undefined ) ? sharedPluginData?.plugin_info : sampleSitePlugin?.plugin_info || {};
				if ( Object.keys( pluginInfo ).length === 0 ) {
					pluginInfo = sharedPluginData.plugin_info || {};
				}

				// Get the best available icon
				const getPluginIcon = () => {
					// First check plugin_info.icons (from WordPress.org API)
					if ( pluginInfo.icons ) {
						if ( pluginInfo.icons[ '2x' ] ) {
							return pluginInfo.icons[ '2x' ];
						}
						if ( pluginInfo.icons[ '1x' ] ) {
							return pluginInfo.icons[ '1x' ];
						}
						if ( pluginInfo.icons.svg ) {
							return pluginInfo.icons.svg;
						}
						if ( pluginInfo.icons.default ) {
							return pluginInfo.icons.default;
						}
					}

					// Then check site plugin data icons
					if ( sampleSitePlugin?.plugin_info?.icons ) {
						if ( sampleSitePlugin.plugin_info.icons[ '2x' ] ) {
							return sampleSitePlugin.plugin_info.icons[ '2x' ];
						}
						if ( sampleSitePlugin.plugin_info.icons[ '1x' ] ) {
							return sampleSitePlugin.plugin_info.icons[ '1x' ];
						}
						if ( sampleSitePlugin.plugin_info.icons.svg ) {
							return sampleSitePlugin.plugin_info.icons.svg;
						}
						if ( sampleSitePlugin.plugin_info.icons.default ) {
							return sampleSitePlugin.plugin_info.icons.default;
						}
					}

					// Fallback to update icons if available
					if ( sampleSitePlugin?.update?.icons ) {
						if ( sampleSitePlugin.update.icons[ '2x' ] ) {
							return sampleSitePlugin.update.icons[ '2x' ];
						}
						if ( sampleSitePlugin.update.icons[ '1x' ] ) {
							return sampleSitePlugin.update.icons[ '1x' ];
						}
						if ( sampleSitePlugin.update.icons.svg ) {
							return sampleSitePlugin.update.icons.svg;
						}
						if ( sampleSitePlugin.update.icons.default ) {
							return sampleSitePlugin.update.icons.default;
						}
					}

					return null;
				};

				transformedPlugins[ slug ] = {
					plugin_info: {
						name: decodeEntities( sampleSitePlugin?.Name || pluginInfo.name || slug ),
						description: decodeEntities(
							sampleSitePlugin?.Description ||
							PurifyElement( pluginInfo.sections?.description )?.substring( 0, 200 ) + '...' ||
							pluginInfo.short_description ||
							'No description available.',
						),
						author: decodeEntities( sampleSitePlugin?.Author || PurifyElement( pluginInfo.author ) || 'Unknown' ),
						version: sharedPluginData.version || sampleSitePlugin?.Version || pluginInfo.version || '0.0.0',
						plugin_uri: sampleSitePlugin?.PluginURI || pluginInfo.homepage || '',
						is_public: sampleSitePlugin?.is_public !== undefined ? sampleSitePlugin.is_public : Boolean( pluginInfo.download_link ),
						plugin_slug: slug,
						is_active: activeSites > 0,
						is_update_available: updateAvailableSites > 0,
						update_info: updateAvailableSites > 0 ? { new_version: pluginInfo.version } : null,
						last_updated: sharedPluginData.updated_at || pluginInfo.last_updated,
						created_at: sharedPluginData.created_at || pluginInfo.added,
						rating: pluginInfo.rating || 0,
						num_ratings: pluginInfo.num_ratings || 0,
						downloaded: pluginInfo.downloaded || 0,
						icon: getPluginIcon(),
						// Keep all additional plugin info
						full_description: decodeEntities( pluginInfo.sections?.description || sampleSitePlugin?.Description || '' ),
						changelog: pluginInfo.sections?.changelog,
						installation: pluginInfo.sections?.installation,
						faq: pluginInfo.sections?.faq,
						screenshots: pluginInfo.screenshots,
						tags: pluginInfo.tags,
						contributors: pluginInfo.contributors,
						donate_link: pluginInfo.donate_link,
						requires: pluginInfo.requires || sampleSitePlugin?.RequiresWP,
						tested: pluginInfo.tested,
						requires_php: pluginInfo.requires_php || sampleSitePlugin?.RequiresPHP,
						requires_plugins: pluginInfo.requires_plugins || sampleSitePlugin?.RequiresPlugins,
						compatibility: pluginInfo.compatibility,
						added: pluginInfo.added,
						homepage: pluginInfo.homepage,
						short_description: decodeEntities( pluginInfo.short_description || '' ),
						// Store available versions for version selection (only for public plugins)
						available_versions: sampleSitePlugin?.is_public !== false && pluginInfo.versions ? pluginInfo.versions : {},
						plugin_path_info: sampleSitePlugin?.plugin_path_info ?? sharedPluginData?.plugin_path_info ?? `${ slug }/${ slug }.php`,
					},
					sites,
					total_sites: totalSites,
					active_sites: activeSites,
					update_available_sites: updateAvailableSites,
					plugin_path_info: sampleSitePlugin?.plugin_path_info ?? sharedPluginData?.plugin_path_info ?? `${ slug }/${ slug }.php`,
				};
				// all all sites urls to plugin data as sites_urls not just current plugin site but all sites to which we are connected
				transformedPlugins[ slug ].sites_urls = allSites;
			}
		} );

		return transformedPlugins;
	}, [ ] );

	const fetchRealTimePluginsData = useCallback( async () => {
		try {
			// setLoading( true ); to avoid flickering of loading state
			setActionLoading( true ); // when calling from action to halt closing modal
			setLoadingProgress( { current: 0, total: 0, message: __( 'Fetching sites…', 'oneupdate' ) } );

			// Step 1: Fetch all sites
			const sites = await fetchSitesWithPluginLoader();

			if ( ! sites || sites.length === 0 ) {
				setLoadingProgress( { current: 0, total: 0, message: __( 'No sites found.', 'oneupdate' ) } );
				return;
			}
			setLoadingProgress( {
				current: 0,
				total: sites.length + 1,
				message: __( 'Fetching shared plugins data…', 'oneupdate' ),
			} );

			// Step 2: Fetch shared plugins data
			// const sharedPluginsData = await fetchSharedPluginsData();
			const sharedPluginsData = Object();

			setLoadingProgress( {
				current: 1,
				total: sites.length + 1,
				message: __( 'Fetching real-time plugin status…', 'oneupdate' ),
			} );

			// Step 3: Fetch real plugin status from each site
			const sitePluginsData = {};

			for ( let i = 0; i < sites.length; i++ ) {
				const site = sites[ i ];
				setLoadingProgress( {
					current: i + 1,
					total: sites.length,
					message: __( 'Fetching plugins info from', 'oneupdate' ) + ' ' + site.name + '…',
				} );

				const plugins = await fetchPluginsFromSite( site );
				sitePluginsData[ site.url ] = {
					site,
					plugins,
				};
			}
			// Step 4: Transform and combine the data
			const transformedData = transformRealTimePluginsData( sharedPluginsData, sitePluginsData, sites );
			setCombinedPluginsBySlug( transformedData );
		} catch ( error ) {
			setGlobalNotice( {
				status: 'error',
				message: sprintf(
					/* translators: %s is the error message */
					__( 'Error fetching plugins data: %s', 'oneupdate' ),
					error.message || __( 'Unknown error', 'oneupdate' ),
				),
			} );
		} finally {
			setLoading( false );
			setLoadingProgress( { current: 0, total: 0, message: '' } );
			setActionLoading( false ); // reset action loading state
		}
	}, [ fetchSitesWithPluginLoader, fetchPluginsFromSite, transformRealTimePluginsData ] );

	// Filter plugins based on search and filters
	const filteredPlugins = useMemo( () => {
		const plugins = Object.values( combinedPluginsBySlug );

		return plugins.filter( ( plugin ) => {
			const matchesSearch =
					plugin.plugin_info.name.toLowerCase().includes( searchQuery.toLowerCase() ) ||
					plugin.plugin_info.description.toLowerCase().includes( searchQuery.toLowerCase() );

			const matchesStatus =
					statusFilter === 'all' ||
					( statusFilter === 'active' && plugin.active_sites > 0 ) ||
					( statusFilter === 'inactive' && plugin.active_sites >= 0 && plugin.active_sites < plugin.total_sites );

			const matchesType =
					typeFilter === 'all' ||
					( typeFilter === 'public' && plugin.plugin_info.is_public ) ||
					( typeFilter === 'private' && ! plugin.plugin_info.is_public );

			const matchesUpdate =
					updateFilter === 'all' || ( updateFilter === 'available' && plugin.update_available_sites > 0 );

			const matchesSite =
				siteFilter === 'all' ||
				( siteFilter === 'common-plugins' && Object.keys( plugin.sites ).length === allAvailableSites.length ) ||
				( siteFilter !== 'all' && Object.keys( plugin.sites ).includes( siteFilter ) );

			return matchesSearch && matchesStatus && matchesType && matchesUpdate && matchesSite;
		} );
	}, [ combinedPluginsBySlug, searchQuery, statusFilter, typeFilter, updateFilter, siteFilter ] );

	const getUpdateTooltipText = ( plugin ) => {
		const updateSites = Object.entries( plugin.sites )
			.filter( ( [ , siteInfo ] ) => siteInfo.is_update_available )
			.map( ( [ , siteInfo ] ) => siteInfo.site_name );

		return sprintf(
			/* translators: %s is the list of sites with updates available */
			__( 'Updates available on: %s', 'oneupdate' ),
			updateSites.join( ', ' ),
		);
	};

	const formatSiteUrl = ( url ) => {
		try {
			return new URL( url ).hostname.replace( 'www.', '' );
		} catch {
			return url;
		}
	};

	// Get available sites for specific actions
	const getAvailableSitesForAction = useCallback( ( plugin, action ) => {
		if ( ! plugin || ! plugin.sites ) {
			return [];
		}

		const existingPluginData = Object.values( plugin.sites )[ 0 ]; // Get first installed site's plugin data
		const basePluginInfo = {
			plugin_path: existingPluginData.plugin_path,
			version: existingPluginData.version || existingPluginData.Version || '0.0.0',
			is_active: false,
			is_update_available: false,
			update_info: null,
			plugin_data: existingPluginData.plugin_data, // Same plugin info
		};

		// Step 2: Filter sites without plugin
		const allPluginSites = plugin.sites_urls;
		const filterSitesForInstall = allPluginSites.filter( ( site ) =>
			! plugin.sites.hasOwnProperty( site.url ),
		);

		// Step 3: Transform to match installed format with plugin info
		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const sitesAvailableForInstall = filterSitesForInstall.map( ( site ) => [
			site.url,
			{
				...basePluginInfo, // Include all plugin info
				site_name: site.name,
				site_id: site.id,
				is_active: false,
				is_update_available: false,
				update_info: null,
			},
		] );

		const sites = Object.entries( plugin.sites );

		switch ( action ) {
			case 'activate':
				return sites.filter( ( [ , siteInfo ] ) => ! siteInfo.is_active );
			case 'deactivate':
				return sites.filter( ( [ , siteInfo ] ) => siteInfo.is_active );
			case 'update':
				return sites.filter( ( [ , siteInfo ] ) => siteInfo.is_update_available );
			case 'install':
				// For install, we want sites where the plugin is not installed
				return sitesAvailableForInstall.length > 0 ? sitesAvailableForInstall : [];
			case 'change-version':
			case 'remove':
				return sites;
			default:
				return sites;
		}
	}, [] );

	// Get available versions for a plugin (latest 5 stable versions)
	const getAvailableVersions = ( plugin ) => {
		if ( ! plugin || ! plugin.plugin_info.is_public || ! plugin.plugin_info.available_versions ) {
			return [];
		}

		const versions = plugin.plugin_info.available_versions;
		const versionKeys = Object.keys( versions );

		if ( versionKeys.length === 0 ) {
			return [];
		}

		// Filter out development versions (beta, rc, dev, etc.)
		const stableVersions = versionKeys.filter( ( version ) => {
			const lowerVersion = version.toLowerCase();
			return (
				! lowerVersion.includes( 'beta' ) &&
				! lowerVersion.includes( 'rc' ) &&
				! lowerVersion.includes( 'dev' ) &&
				! lowerVersion.includes( 'alpha' ) &&
				! lowerVersion.includes( 'trunk' ) &&
				version !== 'trunk'
			);
		} );

		// Sort versions in descending order (newest first)
		const sortedVersions = stableVersions.sort( ( a, b ) => {
			// Simple version comparison - split by dots and compare numerically
			const aParts = a.split( '.' ).map( Number );
			const bParts = b.split( '.' ).map( Number );

			for ( let i = 0; i < Math.max( aParts.length, bParts.length ); i++ ) {
				const aPart = aParts[ i ] || 0;
				const bPart = bParts[ i ] || 0;

				if ( aPart !== bPart ) {
					return bPart - aPart; // Descending order
				}
			}
			return 0;
		} );

		// Return latest 5 stable versions
		const pluginVersions = sortedVersions.slice( 0, 5 ).map( ( version ) => ( {
			label: `${ version }`,
			value: version,
		} ) );

		// add (latest) label to the latest version
		if ( pluginVersions.length > 0 ) {
			const latestVersion = pluginVersions[ 0 ];
			latestVersion.label += ' (' + __( 'Latest', 'oneupdate' ) + ')';
		}
		return pluginVersions;
	};

	// Handle plugin actions
	const handlePluginAction = ( plugin, action ) => {
		setSelectedPlugin( plugin );
		setCurrentAction( action );
		setSelectedSites( [] );

		const availableSites = getAvailableSitesForAction( plugin, action );

		// if install is action then show modal on which its not present
		if ( action === 'install' ) {
			if ( availableSites.length === 0 ) {
				// Show notice that no sites are available for this action
				setGlobalNotice( {
					status: 'error',
					message: __( 'No sites available for installation.', 'oneupdate' ),
				} );
				return;
			}
			// set sites where current plugin is not installed
			setShowSiteSelectionModal( true );
			return;
		}

		// set latest version for 'change-version' action.
		if ( action === 'change-version' && plugin.plugin_info.is_public ) {
			const getPluginVersions = getAvailableVersions( plugin );
			if ( getPluginVersions.length > 0 ) {
				setSelectedVersion( getPluginVersions[ 0 ].value );
			} else {
				setSelectedVersion( plugin.plugin_info.version || '' );
			}
		} else {
			setSelectedVersion( plugin.plugin_info.version || '' );
		}

		if ( availableSites.length === 0 ) {
			// Show notice that no sites are available for this action
			return;
		}

		setShowSiteSelectionModal( true );
	};

	// Execute the selected action
	const executeAction = async () => {
		if ( ! selectedPlugin || ! currentAction || selectedSites.length === 0 ) {
			return;
		}

		setActionLoading( true );

		try {
			const actionData = {
				action: currentAction,
				slug: selectedPlugin.plugin_info.plugin_slug,
				sites: selectedSites,
				plugin_version: selectedVersion || selectedPlugin.plugin_info.version,
				plugin_type: selectedPlugin.plugin_info.is_public ? 'public' : 'private',
				plugin_path_info: selectedPlugin.plugin_path_info,
			};

			const response = await fetch(
				`${ API_NAMESPACE }/execute-plugin-action`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': RestNonce,
					},
					body: JSON.stringify( actionData ),
				},
			);

			if ( ! response.ok ) {
				throw new Error( __( 'Failed to execute action.', 'oneupdate' ) );
			}
			const result = await response.json();
			if ( ! result.success ) {
				throw new Error( result.message || __( 'Action failed.', 'oneupdate' ) );
			}

			// Extract GitHub Actions runner URLs
			const extractGitHubActionUrls = () => {
				if ( ! result.output || ! Array.isArray( result.output ) ) {
					return [];
				}

				return result.output
					.filter( ( item ) =>
						item.response &&
						item.response.success &&
						item.response.run_url,
					)
					.map( ( item ) => ( {
						repo: item.response.repo,
						plugin: item.response.plugin,
						version: item.response.version,
						run_url: item.response.run_url,
						run_id: item.response.run_id,
						site: item.site,
						action: item.action,
					} ) );
			};

			const githubActions = extractGitHubActionUrls();

			// Create formatted message with GitHub Actions links
			const pluginName = selectedPlugin.plugin_info.name || selectedPlugin.plugin_info.plugin_slug;
			let actionVerb = '';
			switch ( currentAction ) {
				case 'activate':
					actionVerb = __( 'Activated', 'oneupdate' );
					break;
				case 'deactivate':
					actionVerb = __( 'Deactivated', 'oneupdate' );
					break;
				case 'update':
					actionVerb = __( 'Updated', 'oneupdate' );
					break;
				case 'install':
					actionVerb = __( 'Installed', 'oneupdate' );
					break;
				case 'remove':
					actionVerb = __( 'Removed', 'oneupdate' );
					break;
				case 'change-version':
					actionVerb = __( 'Version change', 'oneupdate' );
					break;
				default:
					actionVerb = __( 'Executed', 'oneupdate' );
			}
			const names = selectedSites.map( ( url ) => {
				const site = allAvailableSites.find( ( s ) => s.url === url );
				return site ? site.name : ( url );
			} );
			const namesString = names.length > 0 ? names.join( ', ' ) : __( 'selected sites', 'oneupdate' );
			let noticeMessage = '';

			if ( 'change-version' === currentAction || 'install' === currentAction || 'update' === currentAction || 'remove' === currentAction ) {
				noticeMessage = sprintf(
					/* translators: %1s is the plugin name, %2s is the action verb */
					__( '%1$s %2$s PR raised successfully.', 'oneupdate' ),
					pluginName,
					actionVerb,
				);
				noticeMessage += '\n\n';
			} else {
				noticeMessage = sprintf(
				/* translators: %1s is the plugin name, %2s is the action verb, %3s is the site names */
					__( '%1$s %2$s successfully on %3$s.', 'oneupdate' ),
					pluginName,
					actionVerb,
					namesString,
				);
			}

			// add site name and its respective action link to message.
			for ( const action of githubActions ) {
				const site = allAvailableSites.find( ( s ) => s.url === action.site );
				const name = site ? site.name : action.site;
				noticeMessage += `${ name }\n${ action.run_url }`;
				// add \n\n if not last item
				if ( action !== githubActions?.[ githubActions.length - 1 ] ) {
					noticeMessage += '\n\n';
				}
			}
			// set global notice
			setGlobalNotice( {
				status: 'success',
				message: noticeMessage,
				type: githubActions.length > 0 ? 'default' : 'snackbar',
			} );

			// Refresh plugins data
			await fetchRealTimePluginsData();
		} catch ( error ) {
			setGlobalNotice( {
				status: 'error',
				message: sprintf(
					'Failed to execute %s action.',
					currentAction,
				),
			} );
		} finally {
			setActionLoading( false );
			// Close modal
			setShowSiteSelectionModal( false );
			setSelectedPlugin( null );
			setCurrentAction( null );
			setSelectedSites( [] );
		}
	};

	const handleAddPlugin = () => {
		setShowAddPluginModal( true );
		setAddPluginType( '' ); // Reset type
		setShowBackButton( true );
		setGlobalNotice( { status: '', message: '' } );
	};

	const handleUpdateAll = async () => {
		// get all plugins that have updates available
		try {
			setIsBulkUpdateProcess( true );
			const pluginsToUpdate = Object.values( combinedPluginsBySlug ).filter( ( plugin ) => plugin.update_available_sites > 0 );
			if ( pluginsToUpdate.length === 0 ) {
				return;
			}
			const getAvailableSites = ( plugin ) => {
				return Object.entries( plugin.sites )
					.filter( ( [ , siteInfo ] ) => siteInfo.is_update_available )
					.map( ( [ url ] ) => url );
			};
			// get plugins latest version
			const latestVersions = pluginsToUpdate.map( ( plugin ) => {
				const versions = getAvailableVersions( plugin );
				return versions.length > 0 ? versions[ 0 ].value : plugin.plugin_info.version || '';
			} );

			const plugins = pluginsToUpdate.map( ( plugin, index ) => ( {
				slug: plugin.plugin_info.plugin_slug,
				version: latestVersions[ index ],
				sites: getAvailableSites( plugin ),
				plugin_type: plugin.plugin_info.is_public ? 'public' : 'private',
			} ) );

			// Log the update action
			const updateActionData = {
				plugins,
			};
			const response = await fetch(
				`${ API_NAMESPACE }/bulk-plugin-update`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': RestNonce,
					},
					body: JSON.stringify( updateActionData ),
				},
			);
			if ( ! response.ok ) {
				setGlobalNotice( {
					status: 'error',
					message: __( 'Failed to update plugins.', 'oneupdate' ),
				} );
				return;
			}
			const result = await response.json();
			if ( ! result.success ) {
				setGlobalNotice( {
					status: 'error',
					message: result.message || __( 'Failed to update plugins.', 'oneupdate' ),
				} );
				return;
			}

			// Extract GitHub Actions runner URLs
			const extractGitHubActionUrls = () => {
				if ( ! result.response || ! Array.isArray( result.response ) ) {
					return [];
				}

				return result.response
					.filter( ( item ) => item.github_response && item.github_response.success && item.github_response.run_url )
					.map( ( item ) => ( {
						repo: item.github_response.repo,
						plugin: item.github_response.plugin,
						version: item.github_response.version,
						run_url: item.github_response.run_url,
						run_id: item.github_response.run_id,
						name: item.github_response.name,
					} ) );
			};

			const githubActions = extractGitHubActionUrls();

			// Create formatted message with GitHub Actions links grouped by site name
			let noticeMessage = __( 'Plugins update\'s PR raised successfully.', 'oneupdate' );

			if ( githubActions.length > 0 ) {
				// Group actions by site name
				const groupedBySite = githubActions.reduce( ( acc, action ) => {
					const name = action.name || 'Unknown Site';
					if ( ! acc[ name ] ) {
						acc[ name ] = [];
					}
					acc[ name ].push( action );
					return acc;
				}, {} );

				// Format the message with site names and their respective URLs
				const siteGroups = Object.entries( groupedBySite ).map( ( [ name, actions ] ) => {
					const actionLinks = actions.map( ( action ) => action.run_url ).join( '\n' );
					return `${ name }\n${ actionLinks }`;
				} );

				noticeMessage += `\n\n${ siteGroups.join( '\n\n' ) }`;
			}

			// set global notice
			setGlobalNotice( {
				status: 'success',
				message: noticeMessage,
			} );
		} catch ( error ) {
			setGlobalNotice( {
				status: 'error',
				message: __( 'Failed to update plugins.', 'oneupdate' ),
			} );
		} finally {
			setIsBulkUpdateProcess( false );
		}
	};

	// Handle site selection
	const handleSiteToggle = ( url, checked ) => {
		if ( checked ) {
			setSelectedSites( ( prev ) => [ ...prev, url ] );
		} else {
			setSelectedSites( ( prev ) => prev.filter( ( url ) => url !== url ) );
		}
	};

	const handleSelectAllSites = ( checked ) => {
		if ( checked ) {
			const availableSites = getAvailableSitesForAction( selectedPlugin, currentAction );
			setSelectedSites( availableSites.map( ( [ url ] ) => url ) );
		} else {
			setSelectedSites( [] );
		}
	};

	// Get action title and description
	const getActionInfo = ( action ) => {
		switch ( action ) {
			case 'activate':
				return {
					title: __( 'Activate Plugin', 'oneupdate' ),
					description: __( 'Select sites where you want to activate this plugin.', 'oneupdate' ),
					buttonText: __( 'Activate on Selected Sites', 'oneupdate' ),
					icon: 'yes-alt',
				};
			case 'deactivate':
				return {
					title: __( 'Deactivate Plugin', 'oneupdate' ),
					description: __( 'Select sites where you want to deactivate this plugin.', 'oneupdate' ),
					buttonText: __( 'Deactivate on Selected Sites', 'oneupdate' ),
					icon: 'dismiss',
				};
			case 'update':
				return {
					title: __( 'Update Plugin', 'oneupdate' ),
					description: __( 'Select sites where you want to update this plugin.', 'oneupdate' ),
					buttonText: __( 'Update on Selected Sites', 'oneupdate' ),
					icon: 'update',
				};
			case 'change-version':
				return {
					title: __( 'Change Plugin Version', 'oneupdate' ),
					description: __( 'Choose plugin version and select sites where you want to change/update version.', 'oneupdate' ),
					buttonText: __( 'Change Version on Selected Sites', 'oneupdate' ),
					icon: 'admin-tools',
				};
			case 'remove':
				return {
					title: __( 'Remove Plugin', 'oneupdate' ),
					description: __( 'Select sites where you want to remove this plugin.', 'oneupdate' ),
					buttonText: __( 'Remove from Selected Sites', 'oneupdate' ),
					icon: 'trash',
				};
			default:
				return {
					title: __( 'Plugin Action', 'oneupdate' ),
					description: __( 'Select sites for this action.', 'oneupdate' ),
					buttonText: __( 'Execute Action', 'oneupdate' ),
					icon: 'admin-generic',
				};
		}
	};

	// Effects
	useEffect( () => {
		fetchRealTimePluginsData();
	}, [ fetchRealTimePluginsData ] );

	const AddPluginScreen = () => {
		// show 2 cards with options to add public or private plugin and a back button to go back to the main screen
		return (
			<div className="oneupdate-add-plugin-screen">
				{ addPluginType === '' && (
					<>
						{ showBackButton && (
							<Button
								variant="secondary"
								icon={ arrowLeft }
								onClick={ () => {
									setShowAddPluginModal( false );
									setShowBackButton( false );
									setGlobalNotice( { status: '', message: '' } );
								} }
								style={ { marginTop: '16px', marginBottom: '16px' } }
							>
								{ __( 'Back', 'oneupdate' ) }
							</Button>
						) }
						<VStack gap={ 4 } style={ { maxWidth: '600px', minWidth: '600px', margin: '0 auto', padding: '20px' } }>
							<h2 style={ { textAlign: 'center', fontSize: '24px', fontWeight: '600' } }>
								{ __( 'Add Plugin', 'oneupdate' ) }
							</h2>
							<p style={ { textAlign: 'center', color: '#6c757d' } }>
								{ __( 'Choose how you want to add a plugin to your sites.', 'oneupdate' ) }
							</p>
							<Grid columns={ 2 } gap={ 4 }>
								<Card
									onClick={ () => {
										setAddPluginType( 'public' );
										setShowBackButton( true );
										setGlobalNotice( { status: '', message: '' } );
									} }
									style={ {
										cursor: 'pointer',
										borderRadius: '12px',
										boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
									} }
								>
									<CardBody>
										<h3>{ __( 'Public Plugin', 'oneupdate' ) }</h3>
										<p>{ __( 'Add a plugin from the WordPress.org repository.', 'oneupdate' ) }</p>
									</CardBody>
								</Card>
								<Card
									onClick={ () => {
										if ( isValidS3Credentials === false ) {
											setGlobalNotice( {
												status: 'error',
												message: __( 'Invalid S3 credentials. Please check your settings.', 'oneupdate' ),
											} );
											return;
										}
										setAddPluginType( 'private' );
										setShowBackButton( true );
										setGlobalNotice( { status: '', message: '' } );
									} }
									style={ {
										cursor: 'pointer',
										borderRadius: '12px',
										boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
									} }
									disabled={ isValidS3Credentials === false }
								>
									<CardBody>
										<h3>{ __( 'Private Plugin', 'oneupdate' ) }</h3>
										<p>{ __( 'Upload a custom plugin from your computer.', 'oneupdate' ) }</p>
									</CardBody>
								</Card>
							</Grid>
						</VStack>
					</>
				) }
				{ addPluginType && renderPluginScreen() }
			</div>
		);
	};

	const renderPluginScreen = () => {
		if ( addPluginType === 'public' ) {
			return (
				<>
					{ showBackButton && (
						<Button
							variant="secondary"
							icon={ arrowLeft }
							onClick={ () => {
								setShowAddPluginModal( true );
								setAddPluginType( '' );
								setShowBackButton( true );
								setGlobalNotice( { status: '', message: '' } );
							} }
							style={ { marginBottom: '16px', marginTop: '16px' } }
						>
							{ __( 'Back', 'oneupdate' ) }
						</Button>
					) }
					<PluginsSharing
						onClose={ () => {
							setShowAddPluginModal( false );
							setAddPluginType( '' );
							setShowBackButton( false );
						} }
					/>
				</>
			);
		} else if ( addPluginType === 'private' ) {
			return (
				<>
					{ showBackButton && (
						<Button
							variant="secondary"
							icon={ arrowLeft }
							onClick={ () => {
								setShowAddPluginModal( true );
								setAddPluginType( '' );
								setShowBackButton( true );
								setGlobalNotice( { status: '', message: '' } );
							} }
							style={ { marginBottom: '16px', marginTop: '16px' } }
						>
							{ __( 'Back', 'oneupdate' ) }
						</Button>
					) }
					<S3ZipUploader
						onClose={ () => {
							setShowAddPluginModal( false );
							setAddPluginType( '' );
							setShowBackButton( false );
						} }
					/>
				</>
			);
		}
		return null;
	};

	if ( loading ) {
		return (
			<div style={ { textAlign: 'center', padding: '60px 20px' } }>
				<Spinner style={ { width: '40px', height: '40px' } } />
				<Spacer marginTop={ 4 } />
				<p style={ { color: '#6c757d', margin: '16px 0 0 0', fontSize: '16px' } }>
					{ loadingProgress.message || __( 'Loading plugins…', 'oneupdate' ) }
				</p>
				{ loadingProgress.total > 0 && (
					<div style={ { marginTop: '16px', maxWidth: '300px', margin: '16px auto 0', minWidth: '300px' } }>
						<div
							style={ {
								background: '#f1f1f1',
								borderRadius: '10px',
								height: '8px',
								overflow: 'hidden',
							} }
						>
							<div
								style={ {
									background: '#3858e9',
									height: '100%',
									width: `${ ( loadingProgress.current / loadingProgress.total ) * 100 }%`,
									transition: 'width 0.3s ease',
								} }
							/>
						</div>
						<p style={ { color: '#6c757d', margin: '8px 0 0 0', fontSize: '14px' } }>
							{ loadingProgress.current } of { loadingProgress.total }
						</p>
					</div>
				) }
			</div>
		);
	}

	const totalPlugins = Object.keys( combinedPluginsBySlug ).length;
	const activePlugins = Object.values( combinedPluginsBySlug ).filter( ( p ) => p.active_sites > 0 ).length;
	const updatesAvailable = Object.values( combinedPluginsBySlug ).filter( ( p ) => p.update_available_sites > 0 ).length;
	const privatePlugins = Object.values( combinedPluginsBySlug ).filter( ( p ) => ! p.plugin_info.is_public ).length;

	return (
		<>
			{ globalNotice.message && actionLoading === false && (
				globalNotice.type !== 'snackbar' ? (
					<Notice
						status={ globalNotice.status }
						isDismissible={ globalNotice.isDismissible }
						onRemove={ () => setGlobalNotice( { status: '', isDismissible: false, message: '' } ) }
						style={ { marginBottom: '20px' } }
						type={ globalNotice.type || 'default' }
					>
						{ globalNotice.message }
					</Notice>
				) : (
					<Snackbar
						status={ globalNotice.status }
						isDismissible={ globalNotice.isDismissible }
						onRemove={ () => setGlobalNotice( { status: '', isDismissible: false, message: '' } ) }
						style={ { marginBottom: '20px' } }
						type={ globalNotice.type || 'default' }
						className={ globalNotice?.status === 'error' ? 'oneupdate-error-notice' : 'oneupdate-success-notice' }
					>
						{ globalNotice.message }
					</Snackbar>
				)
			) }
			{ showAddPluginModal ? (
				<AddPluginScreen />
			) : (
				<div style={ { margin: '0 auto', paddingTop: '20px' } }>
					{ /* Header */ }
					<div
						style={ {
							background: 'linear-gradient(135deg, #fff 0%, #f8fbff 100%)',
							padding: '32px',
							marginBottom: '24px',
							border: '1px solid #e1e5e9',
							borderRadius: '12px',
							boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
						} }
					>
						<Flex justify="space-between" align="center">
							<FlexBlock>
								<h1
									style={ {
										margin: '0 0 8px 0',
										fontSize: '28px',
										fontWeight: '600',
									} }
								>
									{ __( 'OneUpdate - Plugin Manager', 'oneupdate' ) }
								</h1>
								<p style={ { margin: 0, color: '#50575e', fontSize: '16px' } }>
									{ __( 'Manage plugins across all your WordPress sites', 'oneupdate' ) }
								</p>
							</FlexBlock>
							<FlexItem>
								<Flex gap={ 3 }>
									<FlexItem>
										<Button
											variant="secondary"
											onClick={ handleUpdateAll }
											disabled={ updatesAvailable === 0 || isBulkUpdateProcess }
											icon={ loop }
											className={ ( isBulkUpdateProcess ) ? 'is-busy' : '' }
										>
											{ __( 'Update All', 'oneupdate' ) }
										</Button>
									</FlexItem>
									<FlexItem>
										<Button
											variant="primary"
											onClick={ handleAddPlugin }
											icon={ plus }
											disabled={ isBulkUpdateProcess }
										>
											{ __( 'Add Plugin', 'oneupdate' ) }
										</Button>
									</FlexItem>
								</Flex>
							</FlexItem>
						</Flex>
					</div>

					<>
						<Grid columns={ 4 } gap={ 6 } style={ { marginBottom: '24px' } }>
							{ [
								{ value: totalPlugins, label: 'Total Plugins', color: '#0073aa' },
								{ value: activePlugins, label: 'Active', color: '#00a32a' },
								{ value: updatesAvailable, label: 'Updates', color: '#dba617' },
								{ value: privatePlugins, label: 'Private', color: '#826eb4' },
							].map( ( stat, index ) => (
								<Card
									key={ index }
									style={ {
										border: '1px solid #e1e5e9',
										borderRadius: '12px',
										boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
										background: '#fff',
										transition: 'all 0.3s ease',
									} }
									onMouseEnter={ ( e ) => {
										e.currentTarget.style.transform = 'translateY(-2px)';
										e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.12)';
									} }
									onMouseLeave={ ( e ) => {
										e.currentTarget.style.transform = 'translateY(0)';
										e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
									} }
								>
									<CardBody style={ { textAlign: 'center', padding: '24px' } }>
										<div
											style={ {
												fontSize: '32px',
												fontWeight: '600',
												color: stat.color,
												marginBottom: '8px',
												lineHeight: '1',
											} }
										>
											{ stat.value }
										</div>
										<div style={ { color: '#6c757d', fontSize: '14px', fontWeight: '500' } }>
											{ stat.label }
										</div>
									</CardBody>
								</Card>
							) ) }
						</Grid>

						<Card
							style={ {
								marginBottom: '24px',
								border: '1px solid #e1e5e9',
								borderRadius: '12px',
								boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
								background: '#fff',
							} }
						>
							<CardBody style={ { padding: '24px' } }>
								<Grid columns={ 7 } gap={ 4 }>
									<div style={ { gridColumn: 'span 3' } }>
										<TextControl
											label={ __( 'Search Plugins', 'oneupdate' ) }
											value={ searchQuery }
											onChange={ setSearchQuery }
											placeholder={ __( 'Search by name or description…', 'oneupdate' ) }
											style={ {
												fontSize: '14px',
											} }
											disabled={ isBulkUpdateProcess }
										/>
									</div>
									<SelectControl
										label={ __( 'Status', 'oneupdate' ) }
										value={ statusFilter }
										onChange={ setStatusFilter }
										options={ [
											{ label: __( 'All Status', 'oneupdate' ), value: 'all' },
											{ label: __( 'Active', 'oneupdate' ), value: 'active' },
											{ label: __( 'Inactive', 'oneupdate' ), value: 'inactive' },
										] }
										disabled={ isBulkUpdateProcess }
									/>
									<SelectControl
										label={ __( 'Type', 'oneupdate' ) }
										value={ typeFilter }
										onChange={ setTypeFilter }
										options={ [
											{ label: __( 'All Types', 'oneupdate' ), value: 'all' },
											{ label: __( 'Public', 'oneupdate' ), value: 'public' },
											{ label: __( 'Private', 'oneupdate' ), value: 'private' },
										] }
										disabled={ isBulkUpdateProcess }
									/>
									<SelectControl
										label={ __( 'Updates', 'oneupdate' ) }
										value={ updateFilter }
										onChange={ setUpdateFilter }
										options={ [
											{ label: __( 'All Updates', 'oneupdate' ), value: 'all' },
											{ label: __( 'Updates Available', 'oneupdate' ), value: 'available' },
										] }
										disabled={ isBulkUpdateProcess }
									/>
									{ /* Site specific filter */ }
									<SelectControl
										label={ __( 'Filter By Site', 'oneupdate' ) }
										value={ siteFilter }
										onChange={ setSiteFilter }
										options={ [
											{ label: __( 'All Sites', 'oneupdate' ), value: 'all' },
											{ label: __( 'Common plugins', 'oneupdate' ), value: 'common-plugins' },
											...allAvailableSites.map( ( site ) => ( {
												label: site.name,
												value: site.url,
											} ) ),
										] }
										disabled={ isBulkUpdateProcess }
									/>
								</Grid>
							</CardBody>
						</Card>
					</>

					{ /* Results */ }
					<p style={ { marginBottom: '20px', color: '#6c757d', fontSize: '14px', fontWeight: '500' } }>
						{ sprintf(
							/* translators: %1$d is the number of filtered plugins, %2$d is the total number of plugins */
							__( 'Showing %1$d of %2$d plugins', 'oneupdate' ),
							filteredPlugins.length, totalPlugins,
						) }
					</p>

					{ /* Plugin Grid */ }
					<div
						style={ {
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
							gap: '24px',
							padding: '0',
						} }
					>
						{ filteredPlugins.map( ( plugin ) => (
							<div
								key={ plugin.plugin_info.plugin_slug }
								style={ {
									display: 'flex',
									flexDirection: 'column',
									border: '1px solid #e1e5e9',
									borderRadius: '12px',
									padding: '24px',
									background: '#fff',
									boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
									transition: 'all 0.3s ease',
									position: 'relative',
									overflow: 'hidden',
								} }
							>
								{ /* Plugin Header */ }
								<div style={ { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' } }>
									<div style={ { flexShrink: 0, position: 'relative', height: '56px' } }>
										<div
											style={ {
												width: '56px',
												height: '56px',
												borderRadius: '12px',
												background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
												border: '2px solid #f1f3f4',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												transition: 'border-color 0.2s ease',
												overflow: 'hidden',
											} }
										>
											{ plugin.plugin_info.icon ? (
												<img
													src={ plugin.plugin_info.icon || '/placeholder.svg' }
													alt={ plugin.plugin_info.name }
													style={ {
														width: '100%',
														height: '100%',
														objectFit: 'cover',
														borderRadius: '10px',
													} }
													onError={ ( e ) => {
														e.target.style.display = 'none';
														e.target.nextSibling.style.display = 'flex';
													} }
												/>
											) : null }
											<Dashicon
												icon="admin-plugins"
												style={ {
													fontSize: '24px',
													color: '#6c757d',
													display: plugin.plugin_info.icon ? 'none' : 'flex',
													alignItems: 'center',
													justifyContent: 'center',
												} }
											/>
										</div>
									</div>
									<div style={ { flex: 1, minWidth: 0 } }>
										<h3
											style={ {
												margin: '0 0 8px 0',
												fontSize: '18px',
												fontWeight: '600',
												color: '#23282d',
												lineHeight: '1.3',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											} }
										>
											{ decodeEntities( plugin.plugin_info.name ) }
										</h3>
										<p style={ { margin: '0 0 8px 0', color: '#6c757d', fontSize: '13px' } }>
											by { decodeEntities( plugin.plugin_info.author ) }
										</p>
										<Flex gap={ 2 } style={ { marginBottom: '8px', justifyContent: 'flex-start', width: 'max-content' } }>
											<FlexItem>
												<div
													style={ {
														display: 'flex',
														alignItems: 'center',
														gap: '6px',
														background: '#f8f9fa',
														padding: '4px 10px',
														borderRadius: '16px',
														fontSize: '12px',
														border: '1px solid #e9ecef',
														width: 'max-content',
													} }
												>
													<span style={ { color: '#6c757d', fontWeight: '500' } }>Current version</span>
													<span
														style={ {
															color: '#495057',
															fontWeight: '500',
															fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
														} }
													>
														{ plugin.plugin_info.version }
													</span>
												</div>
											</FlexItem>
											<FlexItem>
												<span
													style={ {
														display: 'inline-block',
														background: plugin.plugin_info.is_public
															? 'linear-gradient(135deg, #00a32a 0%, #008a20 100%)'
															: 'linear-gradient(135deg, #826eb4 0%, #6c5b7b 100%)',
														color: '#fff',
														padding: '4px 12px',
														borderRadius: '16px',
														fontSize: '11px',
														fontWeight: '500',
													} }
												>
													{ plugin.plugin_info.is_public
														? __( 'Public', 'oneupdate' )
														: __( 'Private', 'oneupdate' ) }
												</span>
											</FlexItem>
										</Flex>
									</div>
									<div>
										<DropdownMenu
											icon="ellipsis"
											label={ __( 'Plugin Actions', 'oneupdate' ) }
											popoverProps={ { position: 'bottom left' } }
											className="oneupdate-plugin-action-dropdown"
											disabled={ isBulkUpdateProcess }
											style={
												{
													pointerEvents: isBulkUpdateProcess ? 'none' : 'auto',
													opacity: isBulkUpdateProcess ? 0.6 : 1,
												}
											}
										>
											{ ( { onClose } ) => {
												return (
													<>
														<MenuGroup>
															{ /* Change Version - only show for public plugins */ }
															{ plugin.plugin_info.is_public && (
																<MenuItem
																	icon="admin-tools"
																	onClick={ () => {
																		handlePluginAction( plugin, 'change-version' );
																		onClose();
																	} }
																>
																	{ __( 'Change version/update', 'oneupdate' ) }
																</MenuItem>
															) }

															{ /* Activate Plugin - only show if plugin is inactive on some sites */ }
															{ plugin.active_sites < plugin.total_sites && (
																<MenuItem
																	icon="yes-alt"
																	onClick={ () => {
																		handlePluginAction( plugin, 'activate' );
																		onClose();
																	} }
																>
																	{ __( 'Activate on sites', 'oneupdate' ) }
																</MenuItem>
															) }

															{ /* Deactivate Plugin - only show if plugin is active on some sites */ }
															{ plugin.active_sites > 0 && (
																<MenuItem
																	icon="dismiss"
																	onClick={ () => {
																		handlePluginAction( plugin, 'deactivate' );
																		onClose();
																	} }
																>
																	{ __( 'Deactivate on sites', 'oneupdate' ) }
																</MenuItem>
															) }

														</MenuGroup>

														<MenuGroup>
															{ /* Add menu item called install on sites which only shows for public plugin and sites on which current plugin is not present */ }
															{ plugin.plugin_info.is_public && getAvailableSitesForAction( plugin, 'install' ).length !== 0 && (
																<MenuItem
																	icon="admin-plugins"
																	onClick={ () => {
																		handlePluginAction( plugin, 'install' );
																		onClose();
																	} }
																>
																	{ __( 'Install on sites', 'oneupdate' ) }
																</MenuItem>
															) }
															<MenuItem
																icon="trash"
																onClick={ () => {
																	handlePluginAction( plugin, 'remove' );
																	onClose();
																} }
																isDestructive
															>
																{ __( 'Uninstall from sites', 'oneupdate' ) }
															</MenuItem>
														</MenuGroup>
														<MenuGroup>
															<MenuItem
																icon="info"
																onClick={ () => {
																	setSelectedPlugin( plugin );
																	setShowPluginModal( true );
																	onClose();
																} }
															>
																{ __( 'Plugin Details', 'oneupdate' ) }
															</MenuItem>
														</MenuGroup>
													</>
												);
											} }
										</DropdownMenu>
									</div>
								</div>

								{ /* Plugin Body */ }
								<div style={ { flex: 1, marginBottom: '20px' } }>
									<p
										style={ {
											margin: 0,
											color: '#50575e',
											lineHeight: '1.5',
											fontSize: '14px',
											display: '-webkit-box',
											WebkitLineClamp: 2,
											WebkitBoxOrient: 'vertical',
											overflow: 'hidden',
										} }
									>
										{ decodeEntities( plugin.plugin_info.description ) }
									</p>
								</div>

								{ /* Plugin Footer */ }
								<div style={ { marginTop: 'auto' } }>
									{ /* Status Badge with Tooltip */ }
									<div style={ { marginBottom: '12px' } }>
										{ /* Show all sites name if available */ }
										{ plugin.sites && Object.keys( plugin.sites ).length > 0 && (
											<div
												style={ {
													marginTop: '8px',
													padding: '8px',
													backgroundColor: '#f8f9fa',
													borderRadius: '6px',
													border: '1px solid #e9ecef',
												} }
											>
												<div
													style={ {
														fontSize: '11px',
														color: '#495057',
														fontWeight: '600',
														marginBottom: '6px',
														display: 'flex',
														alignItems: 'center',
														gap: '4px',
													} }
												>
													<span>🌐</span>
													Installed on { Object.keys( plugin.sites ).length } site{ Object.keys( plugin.sites ).length !== 1 ? 's' : '' }
												</div>
												<div
													style={ {
														display: 'flex',
														flexWrap: 'wrap',
														gap: '4px',
													} }
												>
													{ Object.values( plugin.sites ).map( ( site, index ) => (
														<span
															key={ index }
															style={ {
																fontSize: '10px',
																backgroundColor: site.is_active ? '#d1ecf1' : '#f8d7da',
																color: site.is_active ? '#0c5460' : '#721c24',
																padding: '3px 8px',
																borderRadius: '12px',
																display: 'inline-flex',
																alignItems: 'center',
																gap: '4px',
																border: `1px solid ${ site.is_active ? '#bee5eb' : '#f5c6cb' }`,
																fontWeight: '500',
																cursor: 'help',
															} }
															title={ `${ site.is_active ? 'Active' : 'Inactive' } - Version: ${ site.version }` }
														>
															{ site.site_name.trim() }
															{ site.is_update_available && (
																<span style={ { color: '#e67e22', fontSize: '9px' } }>●</span>
															) }
														</span>
													) ) }
												</div>
											</div>
										) }
									</div>

									{ /* Update Notice */ }
									{ plugin.update_available_sites > 0 && (
										<Tooltip text={ getUpdateTooltipText( plugin ) }>
											<div
												style={ {
													background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
													border: '1px solid #ffeaa7',
													borderRadius: '8px',
													padding: '8px 12px',
													fontSize: '12px',
													color: '#856404',
													display: 'flex',
													alignItems: 'center',
													gap: '6px',
													cursor: 'help',
												} }
											>
												<Dashicon icon="warning" style={ { flexShrink: 0 } } />
												<span>
													{ plugin.update_available_sites === 1
														? __( '1 site needs update', 'oneupdate' )
														: sprintf(
															/* translators: %d is the number of sites needing updates */
															__( '%d sites need updates', 'oneupdate' ),
															plugin.update_available_sites,
														) }
												</span>
											</div>
										</Tooltip>
									) }
								</div>
							</div>
						) ) }
					</div>

					{ filteredPlugins.length === 0 && (
						<div
							style={ {
								textAlign: 'center',
								padding: '60px 20px',
								background: '#fff',
								border: '1px solid #e1e5e9',
								borderRadius: '12px',
								boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '0',
							} }
						>
							<Dashicon icon="admin-plugins" style={ { fontSize: '64px', color: '#c3c4c7', marginBottom: '20px', display: 'flex', alignContent: 'center', justifyContent: 'center' } } />
							<h3 style={ { color: '#6c757d', marginBottom: '12px', fontSize: '20px' } }>
								{ __( 'No plugins found', 'oneupdate' ) }
							</h3>
							<p style={ { color: '#6c757d', margin: 0, lineHeight: '1.5' } }>
								{ __(
									'No plugins found matching your filters. Try adjusting your search criteria.',
									'oneupdate',
								) }
							</p>
						</div>
					) }

					{ /* Site Selection Modal */ }
					{ showSiteSelectionModal && selectedPlugin && currentAction && (
						<Modal
							title={ getActionInfo( currentAction ).title }
							onRequestClose={ () => setShowSiteSelectionModal( false ) }
							style={ { maxWidth: '600px', minWidth: '600px' } }
							shouldCloseOnClickOutside={ actionLoading ? false : true }
						>
							<div style={ { paddingTop: '24px' } }>
								<VStack spacing={ 4 }>
									{ /* Action Description */ }
									<div>
										<p style={ { margin: '0 0 16px 0', color: '#50575e', fontSize: '14px' } }>
											<strong>{ decodeEntities( selectedPlugin.plugin_info.name ) }</strong>
										</p>
										<p style={ { margin: 0, color: '#6c757d', fontSize: '14px' } }>
											{ getActionInfo( currentAction ).description }
										</p>
									</div>

									{ /* Version Selection for Change Version Action */ }
									{ currentAction === 'change-version' && (
										<div>
											{ getAvailableVersions( selectedPlugin ).length > 0 ? (
												<SelectControl
													label={ __( 'Select Version', 'oneupdate' ) }
													value={ selectedVersion === '' ? selectedPlugin.plugin_info.version : selectedVersion }
													onChange={ setSelectedVersion }
													options={ [
														{ label: __( 'Select a version…', 'oneupdate' ), value: '' },
														...getAvailableVersions( selectedPlugin, selectedVersion ),
													] }
													help={ __( 'Choose from the latest 5 stable versions available', 'oneupdate' ) }
													disabled={ actionLoading }
												/>
											) : (
												<Notice status="warning" isDismissible={ false }>
													<p style={ { margin: 0 } }>
														{ __( 'No stable versions available for this plugin.', 'oneupdate' ) }
													</p>
												</Notice>
											) }
										</div>
									) }

									{ /* Action is install then show sites on which plugin is not present */ }

									{ /* Site Selection */ }
									<div>
										<div style={ { marginBottom: '16px', display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' } }>
											<CheckboxControl
												label={ __( 'Select All Sites', 'oneupdate' ) }
												checked={ selectedSites.length === getAvailableSitesForAction( selectedPlugin, currentAction ).length }
												onChange={ handleSelectAllSites }
												style={ { fontWeight: '500' } }
												disabled={ actionLoading }
											/>
											<Button
												variant="link"
												onClick={ () => setSelectedSites( [] ) }
												disabled={ selectedSites.length === 0 || actionLoading }
												style={ { fontWeight: '500', marginBottom: '8px' } }
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
											{ getAvailableSitesForAction( selectedPlugin, currentAction ).length === 0 ? (
												<Notice status="warning" isDismissible={ false }>
													<p style={ { margin: 0 } }>
														{ currentAction === 'activate' &&
																__(
																	'No sites available for activation. Plugin is already active on all sites.',
																	'oneupdate',
																) }
														{ currentAction === 'deactivate' &&
																__(
																	'No sites available for deactivation. Plugin is not active on any sites.',
																	'oneupdate',
																) }
														{ currentAction === 'update' &&
																__( 'No sites have updates available for this plugin.', 'oneupdate' ) }
													</p>
												</Notice>
											) : (
												<VStack spacing={ 2 }>
													{ getAvailableSitesForAction( selectedPlugin, currentAction ).map( ( [ url, siteInfo ] ) => (
														<div
															key={ url }
															style={ { padding: '8px', border: '1px solid #f0f0f1', borderRadius: '4px', cursor: 'pointer' } }
															role="button"
															tabIndex={ 0 }
															onClick={ () => {
																if ( actionLoading ) {
																	return;
																}

																handleSiteToggle( url, ! selectedSites.includes( url ) );
															} }
															onKeyDown={ ( e ) => {
																if ( actionLoading ) {
																	e.preventDefault();
																	return;
																}
																if ( e.key === 'Enter' || e.key === ' ' ) {
																	e.preventDefault();
																	handleSiteToggle( url, ! selectedSites.includes( url ) );
																}
															} }
															aria-pressed={ selectedSites.includes( url ) }
														>
															<CheckboxControl
																className="oneupdate-site-checkbox"
																label={
																	<div>
																		<div style={ { fontWeight: '500', color: '#23282d' } }>
																			{ siteInfo.site_name || formatSiteUrl( url ) }
																		</div>
																		<div style={ { fontSize: '12px', color: '#6c757d' } }>
																			{ ( url ) } • v{ siteInfo.version }
																			{ siteInfo.is_active && (
																				<span style={ { color: '#00a32a', marginLeft: '8px' } }>
																					{ __( 'Active', 'oneupdate' ) }
																				</span>
																			) }
																			{ siteInfo.is_update_available && (
																				<span style={ { color: '#d63638', marginLeft: '8px' } }>
																					{ __( 'Update Available', 'oneupdate' ) }
																				</span>
																			) }
																		</div>
																	</div>
																}
																checked={ selectedSites.includes( url ) }
																disabled={ actionLoading }
															/>
														</div>
													) ) }
												</VStack>
											) }
										</div>
									</div>

									{ /* Action Buttons */ }
									<HStack justify="flex-end" spacing={ 3 }>
										<Button
											variant="secondary"
											onClick={ () => setShowSiteSelectionModal( false ) }
											disabled={ actionLoading }
										>
											{ __( 'Cancel', 'oneupdate' ) }
										</Button>
										<Button
											variant="primary"
											onClick={ executeAction }
											disabled={
												selectedSites.length === 0 ||
												actionLoading ||
												( currentAction === 'change-version' && ! selectedVersion )
											}
											isBusy={ actionLoading }
											isDestructive={ currentAction === 'remove' }
										>
											<Dashicon icon={ getActionInfo( currentAction ).icon } style={ { marginRight: '8px' } } />
											{ actionLoading
												? __( 'Processing…', 'oneupdate' )
												: getActionInfo( currentAction ).buttonText }
										</Button>
									</HStack>
								</VStack>
							</div>
						</Modal>
					) }

					{ /* Plugin Details Modal */ }
					{ showPluginModal && selectedPlugin && (
						<Modal
							title={ decodeEntities( selectedPlugin.plugin_info.name ) }
							onRequestClose={ () => setShowPluginModal( false ) }
							style={ { maxWidth: '800px', minWidth: '800px' } }
							shouldCloseOnClickOutside={ true }
						>
							<div style={ { paddingTop: '24px' } }>
								{ /* Plugin Header */ }
								<div style={ { display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'center' } }>
									<div style={ { flexShrink: 0 } }>
										<div
											style={ {
												width: '80px',
												height: '80px',
												borderRadius: '12px',
												background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
												border: '2px solid #f1f3f4',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												overflow: 'hidden',
											} }
										>
											{ selectedPlugin.plugin_info.icon ? (
												<img
													src={ selectedPlugin.plugin_info.icon || '/placeholder.svg' }
													alt={ selectedPlugin.plugin_info.name }
													style={ {
														width: '100%',
														height: '100%',
														objectFit: 'cover',
														borderRadius: '10px',
													} }
												/>
											) : (
												<Dashicon icon="admin-plugins" style={ { fontSize: '32px', color: '#6c757d', display: 'flex', alignItems: 'center', justifyContent: 'center' } } />
											) }
										</div>
									</div>
									<div style={ { } }>
										<p style={ { margin: '0 0 12px 0', color: '#6c757d', fontSize: '16px' } }>
											by { decodeEntities( selectedPlugin.plugin_info.author ) }
										</p>
										<Flex gap={ 3 } style={ { justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap' } }>
											<FlexItem>
												<span
													style={ {
														background: '#f8f9fa',
														padding: '6px 12px',
														borderRadius: '16px',
														fontSize: '14px',
														border: '1px solid #e9ecef',
														fontWeight: '500',
													} }
												>
													Version { selectedPlugin.plugin_info.version }
												</span>
											</FlexItem>
											<FlexItem>
												<span
													style={ {
														background: selectedPlugin.plugin_info.is_public
															? 'linear-gradient(135deg, #00a32a 0%, #008a20 100%)'
															: 'linear-gradient(135deg, #826eb4 0%, #6c5b7b 100%)',
														color: '#fff',
														padding: '6px 12px',
														borderRadius: '16px',
														fontSize: '14px',
														fontWeight: '500',
													} }
												>
													{ selectedPlugin.plugin_info.is_public
														? __( 'Public Plugin', 'oneupdate' )
														: __( 'Private Plugin', 'oneupdate' ) }
												</span>
											</FlexItem>
											{ selectedPlugin.plugin_info.rating > 0 && (
												<FlexItem>
													<span
														style={ {
															background: '#fff3cd',
															padding: '6px 12px',
															borderRadius: '16px',
															fontSize: '14px',
															border: '1px solid #ffeaa7',
															color: '#856404',
															fontWeight: '500',
														} }
													>
														⭐ { selectedPlugin.plugin_info.rating }% ({ selectedPlugin.plugin_info.num_ratings } reviews)
													</span>
												</FlexItem>
											) }
										</Flex>
									</div>
								</div>

								{ /* Description */ }
								<div style={ { marginBottom: '24px' } }>
									<h4 style={ { margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#23282d' } }>
										{ __( 'Description', 'oneupdate' ) }
									</h4>
									<div
										style={ {
											color: '#50575e',
											lineHeight: '1.6',
											fontSize: '14px',
										} }
										dangerouslySetInnerHTML={ {
											__html: selectedPlugin.plugin_info.full_description || selectedPlugin.plugin_info.description,
										} }
									/>
								</div>

								{ /* Plugin Details Grid */ }
								<Grid columns={ 2 } gap={ 6 } style={ { marginBottom: '24px' } }>
									<div>
										<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'Author', 'oneupdate' ) }
										</h4>
										<p style={ { margin: 0, color: '#50575e' } }>{ selectedPlugin.plugin_info.author }</p>
									</div>
									<div>
										<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'Version', 'oneupdate' ) }
										</h4>
										<p style={ { margin: 0, color: '#50575e' } }>{ selectedPlugin.plugin_info.version }</p>
									</div>
									<div>
										<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'Sites', 'oneupdate' ) }
										</h4>
										<p style={ { margin: 0, color: '#50575e' } }>
											{ selectedPlugin.active_sites }/{ selectedPlugin.total_sites } active
										</p>
									</div>
									{ selectedPlugin.plugin_info.downloaded > 0 && (
										<div>
											<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
												{ __( 'Downloads', 'oneupdate' ) }
											</h4>
											<p style={ { margin: 0, color: '#50575e' } }>
												{ selectedPlugin.plugin_info.downloaded.toLocaleString() }
											</p>
										</div>
									) }
									{ selectedPlugin.plugin_info.requires && (
										<div>
											<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
												{ __( 'Requires WordPress', 'oneupdate' ) }
											</h4>
											<p style={ { margin: 0, color: '#50575e' } }>{ selectedPlugin.plugin_info.requires }</p>
										</div>
									) }
									{ selectedPlugin.plugin_info.tested && (
										<div>
											<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
												{ __( 'Tested up to', 'oneupdate' ) }
											</h4>
											<p style={ { margin: 0, color: '#50575e' } }>{ selectedPlugin.plugin_info.tested }</p>
										</div>
									) }
									{ selectedPlugin.plugin_info.requires_php && (
										<div>
											<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
												{ __( 'Requires PHP', 'oneupdate' ) }
											</h4>
											<p style={ { margin: 0, color: '#50575e' } }>{ selectedPlugin.plugin_info.requires_php }</p>
										</div>
									) }
									{ selectedPlugin.plugin_info.last_updated && (
										<div>
											<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
												{ __( 'Last Updated', 'oneupdate' ) }
											</h4>
											<p style={ { margin: 0, color: '#50575e' } }>
												{ new Date( selectedPlugin.plugin_info.last_updated ).toLocaleDateString() }
											</p>
										</div>
									) }
								</Grid>

								{ /* Tags */ }
								{ selectedPlugin.plugin_info.tags && Object.keys( selectedPlugin.plugin_info.tags ).length > 0 && (
									<div style={ { marginBottom: '24px' } }>
										<h4 style={ { margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'Tags', 'oneupdate' ) }
										</h4>
										<Flex gap={ 2 } style={ { justifyContent: 'flex-start', flexWrap: 'wrap' } }>
											{ Object.keys( selectedPlugin.plugin_info.tags ).map( ( tag ) => (
												<FlexItem key={ tag }>
													<span
														style={ {
															background: '#f8f9fa',
															padding: '4px 8px',
															borderRadius: '12px',
															fontSize: '12px',
															border: '1px solid #e9ecef',
															color: '#495057',
														} }
													>
														{ tag }
													</span>
												</FlexItem>
											) ) }
										</Flex>
									</div>
								) }

								{ /* Plugin URI */ }
								{ selectedPlugin.plugin_info.plugin_uri && (
									<div style={ { marginBottom: '24px' } }>
										<h4 style={ { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'Plugin URI', 'oneupdate' ) }
										</h4>
										<a
											href={ selectedPlugin.plugin_info.plugin_uri }
											target="_blank"
											rel="noopener noreferrer"
											style={ { color: '#0073aa', textDecoration: 'none' } }
										>
											{ selectedPlugin.plugin_info.plugin_uri }
										</a>
									</div>
								) }

								{ /* Installation Instructions */ }
								{ selectedPlugin.plugin_info.installation && (
									<div style={ { marginBottom: '24px' } }>
										<h4 style={ { margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'Installation', 'oneupdate' ) }
										</h4>
										<div
											style={ {
												color: '#50575e',
												lineHeight: '1.6',
												fontSize: '14px',
											} }
											dangerouslySetInnerHTML={ { __html: selectedPlugin.plugin_info.installation } }
										/>
									</div>
								) }

								{ /* FAQ */ }
								{ selectedPlugin.plugin_info.faq && (
									<div style={ { marginBottom: '24px' } }>
										<h4 style={ { margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'FAQ', 'oneupdate' ) }
										</h4>
										<div
											style={ {
												color: '#50575e',
												lineHeight: '1.6',
												fontSize: '14px',
											} }
											dangerouslySetInnerHTML={ { __html: selectedPlugin.plugin_info.faq } }
										/>
									</div>
								) }

								{ /* Changelog */ }
								{ selectedPlugin.plugin_info.changelog && (
									<div style={ { marginBottom: '24px' } }>
										<h4 style={ { margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#23282d' } }>
											{ __( 'Changelog', 'oneupdate' ) }
										</h4>
										<div
											style={ {
												color: '#50575e',
												lineHeight: '1.6',
												fontSize: '14px',
												maxHeight: '200px',
												overflowY: 'auto',
												background: '#f8f9fa',
												padding: '16px',
												borderRadius: '8px',
												border: '1px solid #e9ecef',
											} }
											dangerouslySetInnerHTML={ { __html: selectedPlugin.plugin_info.changelog } }
										/>
									</div>
								) }

								<div style={ { textAlign: 'right', marginTop: '32px' } }>
									<Button
										variant="primary"
										onClick={ () => setShowPluginModal( false ) }
									>
										{ __( 'Close', 'oneupdate' ) }
									</Button>
								</div>
							</div>
						</Modal>
					) }

					{ /* Sites Modal */ }
					{ showSitesModal && selectedPlugin && (
						<Modal
							title={ sprintf(
								/* translators: %s is the plugin name */
								__( '%s - Sites', 'oneupdate' ),
								selectedPlugin.plugin_info.name,
							) }
							onRequestClose={ () => setShowSitesModal( false ) }
							style={ { maxWidth: '400px', minWidth: '400px' } }
							shouldCloseOnClickOutside={ true }
						>
							<div style={ { padding: '8px' } }>
								<p style={ { marginBottom: '1rem', color: '#50575e', fontSize: '14px' } }>
									{ __( 'Plugin status across all sites', 'oneupdate' ) }
								</p>

								<div style={ { maxHeight: '400px', overflowY: 'auto' } }>
									{ Object.entries( selectedPlugin.sites ).map( ( [ url, siteInfo ] ) => (
										<Card
											key={ url }
											style={ {
												marginBottom: '12px',
												border: '1px solid #e1e5e9',
												borderRadius: '8px',
												boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
											} }
										>
											<CardBody style={ { padding: '16px' } }>
												<Flex justify="space-between" align="center">
													<FlexBlock>
														<Flex align="center" gap={ 3 }>
															<FlexItem>
																<Dashicon
																	icon={ siteInfo.is_active ? 'yes-alt' : 'marker' }
																	style={ {
																		color: siteInfo.is_active ? '#00a32a' : '#d63638',
																		fontSize: '18px',
																	} }
																/>
															</FlexItem>
															<FlexBlock>
																<div style={ { fontWeight: '500', color: '#23282d', fontSize: '14px' } }>
																	{ siteInfo.site_name || formatSiteUrl( url ) }
																</div>
																<div style={ { fontSize: '12px', color: '#6c757d' } }>
																	{ ( url ) } • v{ siteInfo.version }
																</div>
															</FlexBlock>
														</Flex>
													</FlexBlock>
													<FlexItem>
														<Flex gap={ 3 }>
															<FlexItem>
																<span
																	style={ {
																		color: siteInfo.is_active ? '#00a32a' : '#d63638',
																		fontSize: '13px',
																		fontWeight: '500',
																	} }
																>
																	{ siteInfo.is_active
																		? __( 'Active', 'oneupdate' )
																		: __( 'Inactive', 'oneupdate' ) }
																</span>
															</FlexItem>
															{ siteInfo.is_update_available && (
																<FlexItem>
																	<span
																		style={ {
																			color: '#d63638',
																			fontSize: '13px',
																			fontWeight: '500',
																			padding: '2px 8px',
																			borderRadius: '12px',
																		} }
																	>
																		{ __( 'Update Available', 'oneupdate' ) }
																	</span>
																</FlexItem>
															) }
														</Flex>
													</FlexItem>
												</Flex>
											</CardBody>
										</Card>
									) ) }
								</div>

								<div style={ { textAlign: 'right', marginTop: '24px' } }>
									<Button
										variant="primary"
										onClick={ () => setShowSitesModal( false ) }
									>
										{ __( 'Close', 'oneupdate' ) }
									</Button>
								</div>
							</div>
						</Modal>
					) }
				</div>
			) }
		</>
	);
};

// Render the PluginManager component into the root element
const rootElement = document.getElementById( 'oneupdate-plugin-manager' );
if ( rootElement ) {
	const root = createRoot( rootElement );
	root.render( <PluginManager /> );
}
