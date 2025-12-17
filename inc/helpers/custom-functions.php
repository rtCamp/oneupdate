<?php
/**
 * Custom functions for the plugin.
 *
 * @package oneupdate
 */

use OneUpdate\Plugin_Configs\Constants;
use OneUpdate\Utils;

/**
 * Get plugin template.
 *
 * @param string $template  Name or path of the template within /templates folder without php extension.
 * @param array  $variables pass an array of variables you want to use in template.
 * @param bool   $is_echo      Whether to echo out the template content or not.
 *
 * @return string|void Template markup.
 */
function oneupdate_features_template( $template, $variables = array(), $is_echo = false ) {

	$template_file = sprintf( '%1$s/templates/%2$s.php', ONEUPDATE_PLUGIN_LOADER_FEATURES_PATH, $template );

	if ( ! file_exists( $template_file ) ) {
		return '';
	}

	if ( ! empty( $variables ) && is_array( $variables ) ) {
		extract( $variables, EXTR_SKIP ); // phpcs:ignore WordPress.PHP.DontExtract.extract_extract -- Used as an exception as there is no better alternative.
	}

	ob_start();

	include $template_file; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable

	$markup = ob_get_clean();

	if ( ! $is_echo ) {
		return $markup;
	}

	echo $markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Output escaped already in template.
}

/**
 * Validate API key.
 *
 * @return bool
 */
function oneupdate_validate_api_key(): bool {
	// check if the request is from same site.
	if ( Utils::is_governing_site() ) {
		return current_user_can( 'manage_options' ) ? true : false;
	}

	// check X-OneUpdate-Token header.
	if ( isset( $_SERVER['HTTP_X_ONEUPDATE_PLUGINS_TOKEN'] ) && ! empty( $_SERVER['HTTP_X_ONEUPDATE_PLUGINS_TOKEN'] ) ) {
		$token = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_ONEUPDATE_PLUGINS_TOKEN'] ) );
		// Get the api key from options.
		$api_key = get_option( Constants::ONEUPDATE_API_KEY, '' );
		if ( hash_equals( $token, $api_key ) ) {
			return true;
		}
	}
	return false;
}
