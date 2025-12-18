/**
 * WordPress dependencies
 */
import { createRoot } from 'react-dom/client';

/**
 * Internal dependencies
 */
import SettingsPage from './page';

export type SiteType = 'governing-site' | 'brand-site' | '';

interface OneUpdateSettingsType {
	restUrl: string;
	restNonce: string;
	api_key: string;
	settingsLink: string;
	siteType: SiteType;

	// @todo legacy - to be removed later
	restNamespace?: string;
	nonce?: string;
	currentSiteUrl?: string;
}

declare global {
	interface Window {
		OneUpdateSettings: OneUpdateSettingsType;
	}
}

// Render to Gutenberg admin page with ID: oneupdate-settings-page
const target = document.getElementById( 'oneupdate-settings-page' );
if ( target ) {
	const root = createRoot( target );
	root.render( <SettingsPage /> );
}
