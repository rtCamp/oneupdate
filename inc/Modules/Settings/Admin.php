<?php
/**
 * Settings class.
 * This class handles the settings page for the OneUpdate plugin,
 *
 * @package OneUpdate
 */

namespace OneUpdate\Modules\Settings;

use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Modules\Core\Assets;

/**
 * Class Settings
 */
class Admin implements Registrable {
	/**
	 * The menu slug for the admin menu.
	 *
	 * @todo need to replace globally with single source of truth.
	 *
	 * @var string
	 */
	public const MENU_SLUG = 'oneupdate';

	/**
	 * The screen ID for the settings page.
	 */
	public const SCREEN_ID = self::MENU_SLUG . '-settings';

	/**
	 * Path to the SVG logo for the menu.
	 *
	 * @todo Replace with actual logo.
	 * @var string
	 */
	private const SVG_LOGO_PATH = '';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		add_action( 'admin_footer', [ $this, 'inject_site_selection_modal' ] );
		add_filter( 'plugin_action_links_' . ONEUPDATE_PLUGIN_BASENAME, [ $this, 'add_action_links' ], 2 );
		add_filter( 'admin_body_class', [ $this, 'add_body_classes' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_scripts' ], 25 );

		add_action( 'admin_menu', [ $this, 'add_admin_menu' ], 5 ); // To make sure it get loaded before adding submenus.
		add_action( 'admin_menu', [ $this, 'add_submenu' ], 20 );
		add_action( 'admin_menu', [ $this, 'remove_default_submenu' ], 999 );
	}

	/**
	 * Add admin menu.
	 */
	public function add_admin_menu(): void {
		add_menu_page(
			__( 'OneUpdate', 'oneupdate' ),
			__( 'OneUpdate', 'oneupdate' ),
			'manage_options',
			self::MENU_SLUG,
			'__return_null',
			self::SVG_LOGO_PATH,
			2
		);
	}

	/**
	 * Register the settings page.
	 */
	public function add_submenu(): void {
		// Add the settings submenu page.
		add_submenu_page(
			self::MENU_SLUG,
			__( 'Settings', 'oneupdate' ),
			__( 'Settings', 'oneupdate' ),
			'manage_options',
			self::SCREEN_ID,
			[ $this, 'screen_callback' ],
			999
		);
	}

	/**
	 * Remove the default submenu added by WordPress.
	 */
	public function remove_default_submenu(): void {
		if ( Settings::is_governing_site() && ! empty( Settings::get_shared_sites() ) ) {
			return;
		}
		remove_submenu_page( self::MENU_SLUG, self::MENU_SLUG );
	}

	/**
	 * Admin page content callback.
	 */
	public function screen_callback(): void {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Settings', 'oneupdate' ); ?></h1>
			<div id="oneupdate-settings-page"></div>
		</div>
		<?php
	}

	/**
	 * Inject site selection modal into the admin footer.
	 */
	public function inject_site_selection_modal(): void {
		if ( ! $this->should_display_site_selection_modal() ) {
			return;
		}

		?>
		<div class="wrap">
			<div id="oneupdate-site-selection-modal" class="oneupdate-modal"></div>
		</div>
		<?php
	}

	/**
	 * Add action links to the settings on the plugins page.
	 *
	 * @param string[] $links Existing links.
	 *
	 * @return string[]
	 */
	public function add_action_links( $links ): array {
		// Defense against other plugins.
		if ( ! is_array( $links ) ) {
			_doing_it_wrong( __METHOD__, esc_html__( 'Expected an array.', 'oneupdate' ), '1.0.0' );

			$links = [];
		}

		$links[] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( admin_url( sprintf( 'admin.php?page=%s', self::SCREEN_ID ) ) ),
			__( 'Settings', 'oneupdate' )
		);

		return $links;
	}

	/**
	 * Add body classes for the admin area.
	 *
	 * @param string $classes Existing body classes.
	 */

	/**
	 * Add body classes for the admin area.
	 *
	 * @param string $classes Existing body classes.
	 */
	public function add_body_classes( $classes ): string {
		$current_screen = get_current_screen();

		if ( ! $current_screen ) {
			return $classes;
		}

		// Cast to string in case it's null.
		$classes = $this->add_body_class_for_modal( (string) $classes );
		$classes = $this->add_body_class_for_missing_sites( (string) $classes );

		return $classes;
	}

		/**
		 * Add body class if the modal is going to be shown.
		 *
		 * @param string $classes        Existing body classes.
		 */
	private function add_body_class_for_modal( string $classes ): string {
		if ( ! $this->should_display_site_selection_modal() ) {
			return $classes;
		}

		// Add oneupdate-site-selection-modal class to body.
		$classes .= ' oneupdate-site-selection-modal ';
		return $classes;
	}

	/**
	 * Add body class for missing sites.
	 *
	 * @param string $classes Existing body classes.
	 */
	private function add_body_class_for_missing_sites( string $classes ): string {
		// Bail if the shared sites are already set.
		$shared_sites = Settings::get_shared_sites();
		if ( ! empty( $shared_sites ) ) {
			return $classes;
		}

		$classes .= ' oneupdate-missing-brand-sites ';
		return $classes;
	}

	/**
	 * Enqueue admin scripts.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_scripts( string $hook ): void {

		if ( strpos( $hook, self::SCREEN_ID ) !== false ) {
			wp_localize_script(
				Assets::SETTINGS_SCRIPT_HANDLE,
				'OneUpdateSettings',
				Assets::get_localized_data(),
			);
			wp_enqueue_script( Assets::SETTINGS_SCRIPT_HANDLE );
		}

		if ( ! $this->should_display_site_selection_modal() ) {
			return;
		}

		// Enqueue the onboarding modal.
		$this->enqueue_onboarding_scripts();
	}

	/**
	 * Enqueue scripts and styles for the onboarding screen.
	 */
	private function enqueue_onboarding_scripts(): void {
		if ( ! $this->should_display_site_selection_modal() ) {
			return;
		}

		wp_localize_script(
			Assets::ONBOARDING_SCRIPT_HANDLE,
			'OneUpdateOnboarding',
			[
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'setup_url' => admin_url( sprintf( 'admin.php?page=%s', self::SCREEN_ID ) ),
				'site_type' => Settings::get_site_type(), // @todo We can probably remove this.
			]
		);

		wp_enqueue_script( Assets::ONBOARDING_SCRIPT_HANDLE );
		wp_enqueue_style( Assets::ONBOARDING_SCRIPT_HANDLE );
	}

	/**
	 * Whether to display the site selection modal.
	 */
	private function should_display_site_selection_modal(): bool {
		$current_screen = get_current_screen();
		if ( ! $current_screen || ( 'plugins' !== $current_screen->base && ! str_contains( $current_screen->id, self::MENU_SLUG ) ) ) {
			return false;
		}

		// Bail if the site type is already set.
		return empty( Settings::get_site_type() );
	}
}
