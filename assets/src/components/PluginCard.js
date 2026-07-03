/**
 * WordPress dependencies
 */
import { decodeEntities } from '@wordpress/html-entities';
import { Button, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

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
					<div className="plugin-version-badge">
						<span className="version-label">Latest</span>
						<span className="version-number">v{ version }</span>
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
					{ isSelected && (
						<span className="btn-icon" aria-hidden="true">
							✓
						</span>
					) }
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

export default PluginCard;
