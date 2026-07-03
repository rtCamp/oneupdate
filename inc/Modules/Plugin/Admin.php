<?php
/**
 * Registers the Admin settings used to control the search module.
 *
 * @package OneUpdate\Modules\Settings
 */

declare(strict_types = 1);

namespace OneUpdate\Modules\Plugin;

use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Modules\Core\Assets;
use OneUpdate\Modules\Settings\Settings;

/**
 * Class - Admin
 */
final class Admin implements Registrable {
	/**
	 * The menu slug for the admin menu.
	 *
	 * @todo replace with a cross-plugin menu.
	 */
	public const MENU_SLUG = 'oneupdate';

	/**
	 * The screen ID for the settings page.
	 */
	public const SCREEN_ID = self::MENU_SLUG;

	/**
	 * Pull Requests screen ID.
	 */
	public const PULL_REQUESTS_SCREEN_ID = self::MENU_SLUG . '-pull-requests';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		if ( ! Settings::is_governing_site() || empty( Settings::get_shared_sites() ) ) {
			return;
		}
		add_action( 'admin_menu', [ $this, 'add_submenu' ], 10 );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_scripts' ], 25 );
	}

	/**
	 * Register the settings page.
	 */
	public function add_submenu(): void {
		// Add sub menu under forms inspector - this will rename the first submenu item.
		add_submenu_page(
			self::MENU_SLUG,
			__( 'Plugin Manager', 'oneupdate' ),
			__( 'Plugin Manager', 'oneupdate' ),
			'manage_options',
			self::MENU_SLUG,
			[ $this, 'render_plugin_manager' ]
		);

		// Pull Requests menu page.
		add_submenu_page(
			self::MENU_SLUG,
			__( 'Pull Requests', 'oneupdate' ),
			__( 'Pull Requests', 'oneupdate' ),
			'manage_options',
			self::PULL_REQUESTS_SCREEN_ID,
			[ $this, 'render_pull_requests' ]
		);
	}

	/**
	 * Render admin page
	 */
	public function render_plugin_manager(): void {
		?>
		<div class="wrap">
			<h1 class="oneupdate-heading"><?php esc_html_e( 'OneUpdate - Plugin Manager', 'oneupdate' ); ?></h1>
			<div id="oneupdate-plugin-manager"></div>
		</div>
		<?php
	}

	/**
	 * Render admin page
	 */
	public function render_settings(): void {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Settings', 'oneupdate' ); ?></h1>
			<div id="oneupdate-settings-page"></div>
		</div>
		<?php
	}

	/**
	 * Render pull requests page
	 */
	public function render_pull_requests(): void {
		?>
		<div class="wrap">
			<h1 class="oneupdate-heading"><?php esc_html_e( 'OneUpdate - Pull Requests', 'oneupdate' ); ?></h1>
			<div id="oneupdate-pull-requests"></div>
		</div>
		<?php
	}

	/**
	 * Admin page content callback.
	 */
	public function screen_callback(): void {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Search Settings', 'oneupdate' ); ?></h1>
			<div id="oneupdate-search-settings"></div>
		</div>
		<?php
	}

	/**
	 * Enqueue admin scripts.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_scripts( string $hook ): void {

		if ( strpos( $hook, 'toplevel_page_' . self::SCREEN_ID ) !== false ) {
			$this->enqueue_plugin_manager_script();
		}

		if ( strpos( $hook, self::PULL_REQUESTS_SCREEN_ID ) === false ) {
			return;
		}

		$this->enqueue_pull_requests_script();
	}

	/**
	 * Enqueue plugin manager admin script.
	 */
	private function enqueue_plugin_manager_script(): void {
		wp_localize_script( Assets::PLUGIN_MANAGER_SCRIPT_HANDLE, 'OneUpdatePlugins', Assets::get_localized_data() );
		wp_enqueue_script( Assets::PLUGIN_MANAGER_SCRIPT_HANDLE );
		wp_enqueue_style( Assets::PLUGIN_MANAGER_SCRIPT_HANDLE );
	}

	/**
	 * Enqueue pull requests admin script.
	 */
	private function enqueue_pull_requests_script(): void {
		wp_localize_script(
			Assets::PULL_REQUESTS_SCRIPT_HANDLE,
			'OneUpdatePullRequests',
			array_merge(
				Assets::get_localized_data(),
				[
					'repos' => self::get_repo_brand_site_mapping(),
				]
			)
		);

		wp_enqueue_script( Assets::PULL_REQUESTS_SCRIPT_HANDLE );
	}

	/**
	 * Get mapping of GitHub repos to brand site names.
	 *
	 * @return array<string, string>
	 */
	private static function get_repo_brand_site_mapping(): array {
		$sites   = Settings::get_shared_sites();
		$mapping = [];
		foreach ( $sites as $site ) {
			if ( empty( $site['gh_repo'] ) || empty( $site['name'] ) || in_array( $site['gh_repo'], array_keys( $mapping ), true ) ) {
				continue;
			}
			$mapping[ $site['gh_repo'] ] = $site['name'];
		}
		return $mapping;
	}
}
