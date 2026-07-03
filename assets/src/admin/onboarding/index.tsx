/**
 * WordPress dependencies
 */
/**
 * External dependencies
 */
import { createRoot } from 'react-dom/client';

/**
 * Internal dependencies
 */
import OnboardingScreen, { type SiteType } from './page';

interface OneUpdateOnboarding {
	nonce: string;
	site_type: SiteType | '';
	setup_url: string;
}

declare global {
	interface Window {
		OneUpdateOnboarding: OneUpdateOnboarding;
	}
}

// Render to the target element.
const target = document.getElementById( 'oneupdate-site-selection-modal' );
if ( target ) {
	const root = createRoot( target );
	root.render( <OnboardingScreen /> );
}
