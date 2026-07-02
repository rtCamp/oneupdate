/**
 * WordPress dependencies
 */
import type { ApiFetch } from '@wordpress/api-fetch';

const apiFetch = jest.fn() as jest.Mock & ApiFetch;

apiFetch.use = jest.fn();
apiFetch.createNonceMiddleware = jest.fn( () => {
	const middleware = jest.fn();
	( middleware as jest.Mock & { nonce: string } ).nonce = '';
	return middleware as jest.Mock & { nonce: string };
} );

export default apiFetch;
