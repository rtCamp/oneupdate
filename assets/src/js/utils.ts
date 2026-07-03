/**
 * External dependencies
 */
import DOMPurify from 'dompurify';

/**
 * Helper function to validate if a string is a well-formed URL.
 *
 * @param {string} str - The string to validate as a URL.
 *
 * @return {boolean} True if the string is a valid URL, false otherwise.
 */
const isURL = ( str: string ): boolean => {
	try {
		new URL( str );
		return true;
	} catch {
		return false;
	}
};

/**
 * Validates if a given string is a valid URL.
 *
 * @param {string} url - The URL string to validate.
 *
 * @return {boolean} True if the URL is valid, false otherwise.
 */
const isValidUrl = ( url: string ): boolean => {
	try {
		const parsedUrl = new URL( url );
		return isURL( parsedUrl.href );
	} catch {
		return false;
	}
};

/**
 * Sanitizes a string to prevent XSS attacks by removing potentially harmful HTML tags and attributes.
 *
 * @param {string} item - The string to be sanitized.
 *
 * @return {string} The sanitized string.
 */
const PurifyElement = ( item: string ) => {
	return DOMPurify.sanitize( item, { ALLOWED_TAGS: [] } );
};

export { isURL, isValidUrl, PurifyElement };
