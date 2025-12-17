<?php
/**
 * Class VIP_Activation - this class handles the activation on VIP platforms.
 *
 * @package OneUpdate
 */

declare(strict_types = 1);

namespace OneUpdate\Modules\Plugin;

use OneUpdate\Contracts\Interfaces\Registrable;

/**
 * Class - VIP_Activation
 */
final class VIP_Activation implements Registrable {
	/**
	 * Prefix for options.
	 *
	 * @todo replace with a cross-plugin.
	 */
	private const PREFIX = 'oneupdate_';

	/**
	 * Plugins options.
	 *
	 * @var string
	 */
	public const PLUGINS_OPTIONS = self::PREFIX . 'plugins_options';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		if ( ! function_exists( 'wpcom_vip_load_plugin' ) ) {
			return; // Ensure the function exists before proceeding.
		}

		$plugins_option = get_option( self::PLUGINS_OPTIONS, [] );

		if ( ! is_array( $plugins_option ) || empty( $plugins_option ) ) {
			return;
		}

		foreach ( $plugins_option as $plugin_data ) {
			// check given directory exists into plugins folder.
			if ( ! is_string( $plugin_data ) || 'hello.php' === $plugin_data || ! file_exists( WP_PLUGIN_DIR . '/' . $plugin_data ) ) {
				continue; // Skip invalid plugin data.
			}
			\wpcom_vip_load_plugin( $plugin_data );
		}
	}

	/**
	 * Get plugins options.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_plugins_options(): array {
		$plugins_option = get_option( self::PLUGINS_OPTIONS, [] );

		if ( ! is_array( $plugins_option ) ) {
			return [];
		}

		return $plugins_option;
	}
}
