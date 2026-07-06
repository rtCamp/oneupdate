/**
 * Internal dependencies
 */
/**
 * External dependencies
 */
import { isURL, isValidUrl, PurifyElement } from '@/js/utils';

describe( 'utils', () => {
	describe( 'isURL', () => {
		it( 'should return true for valid URLs', () => {
			expect( isURL( 'https://example.com' ) ).toBe( true );
			expect( isURL( 'http://localhost:3000/path?query=1' ) ).toBe(
				true
			);
			expect( isURL( 'ftp://ftp.example.com' ) ).toBe( true );
		} );

		it( 'should return false for invalid URLs', () => {
			expect( isURL( 'example.com' ) ).toBe( false );
			expect( isURL( 'not-a-url' ) ).toBe( false );
			expect( isURL( '' ) ).toBe( false );
		} );
	} );

	describe( 'isValidUrl', () => {
		it( 'should return true for valid URL string structures', () => {
			expect( isValidUrl( 'https://example.com' ) ).toBe( true );
			expect( isValidUrl( 'http://example.org/dir/file.html' ) ).toBe(
				true
			);
		} );

		it( 'should return false for invalid URL string structures', () => {
			expect( isValidUrl( 'invalid-url' ) ).toBe( false );
			expect( isValidUrl( '' ) ).toBe( false );
		} );
	} );

	describe( 'PurifyElement', () => {
		it( 'should strip HTML tags from input string', () => {
			expect(
				PurifyElement( '<p>Hello <strong>World</strong></p>' )
			).toBe( 'Hello World' );
			expect(
				PurifyElement( '<script>alert("xss")</script>Safe Content' )
			).toBe( 'Safe Content' );
		} );

		it( 'should return empty string when empty input is provided', () => {
			expect( PurifyElement( '' ) ).toBe( '' );
		} );
	} );
} );
