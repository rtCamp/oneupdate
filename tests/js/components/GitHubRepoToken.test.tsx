/**
 * External dependencies
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Internal dependencies
 */
import GitHubRepoToken from '@/components/GitHubRepoToken';

describe( 'GitHubRepoToken', () => {
	const setNoticeMock = jest.fn();
	const fetchAllAvailableGitHubReposMock = jest.fn();

	beforeEach( () => {
		jest.clearAllMocks();
	} );

	it( 'fetches and displays the saved GitHub token on mount', async () => {
		global.fetch = jest.fn().mockResolvedValue( {
			ok: true,
			json: () =>
				Promise.resolve( { github_token: 'ghp_initial_token' } ),
		} ) as typeof fetch;

		render(
			<GitHubRepoToken
				setNotice={ setNoticeMock }
				fetchAllAvailableGitHubRepos={
					fetchAllAvailableGitHubReposMock
				}
			/>
		);

		expect( global.fetch ).toHaveBeenCalledWith(
			expect.stringContaining( '/oneupdate/v1/github-token' ),
			expect.objectContaining( { method: 'GET' } )
		);

		const tokenInput = await screen.findByLabelText(
			/GitHub Personal Access Token/i
		);
		await waitFor( () => {
			expect( tokenInput ).toHaveValue( 'ghp_initial_token' );
		} );
	} );

	it( 'updates input value when typing', async () => {
		global.fetch = jest.fn().mockResolvedValue( {
			ok: true,
			json: () => Promise.resolve( {} ),
		} ) as typeof fetch;

		render(
			<GitHubRepoToken
				setNotice={ setNoticeMock }
				fetchAllAvailableGitHubRepos={
					fetchAllAvailableGitHubReposMock
				}
			/>
		);

		const tokenInput = await screen.findByLabelText(
			/GitHub Personal Access Token/i
		);
		fireEvent.change( tokenInput, { target: { value: 'ghp_new_token' } } );
		expect( tokenInput ).toHaveValue( 'ghp_new_token' );
	} );

	it( 'shows success notice and calls fetchAllAvailableGitHubRepos when token is saved successfully', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce( {
				ok: true,
				json: () => Promise.resolve( { github_token: '' } ),
			} )
			.mockResolvedValueOnce( {
				ok: true,
				json: () => Promise.resolve( { success: true } ),
			} ) as typeof fetch;

		render(
			<GitHubRepoToken
				setNotice={ setNoticeMock }
				fetchAllAvailableGitHubRepos={
					fetchAllAvailableGitHubReposMock
				}
			/>
		);

		const tokenInput = await screen.findByLabelText(
			/GitHub Personal Access Token/i
		);
		fireEvent.change( tokenInput, {
			target: { value: 'ghp_valid_token' },
		} );

		const saveButton = screen.getByRole( 'button', {
			name: /Save GitHub Token/i,
		} );
		fireEvent.click( saveButton );

		await waitFor( () => {
			expect( global.fetch ).toHaveBeenLastCalledWith(
				expect.stringContaining( '/oneupdate/v1/github-token' ),
				expect.objectContaining( {
					method: 'POST',
					body: JSON.stringify( { token: 'ghp_valid_token' } ),
				} )
			);
		} );

		await waitFor( () => {
			expect( setNoticeMock ).toHaveBeenCalledWith( {
				type: 'success',
				message: 'GitHub token saved successfully.',
			} );
		} );

		expect( fetchAllAvailableGitHubReposMock ).toHaveBeenCalled();
	} );

	it( 'shows error notice when API returns status 400 or fails', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce( {
				ok: true,
				json: () => Promise.resolve( { github_token: '' } ),
			} )
			.mockResolvedValueOnce( {
				ok: false,
				status: 400,
				json: () => Promise.resolve( {} ),
			} ) as typeof fetch;

		render(
			<GitHubRepoToken
				setNotice={ setNoticeMock }
				fetchAllAvailableGitHubRepos={
					fetchAllAvailableGitHubReposMock
				}
			/>
		);

		const tokenInput = await screen.findByLabelText(
			/GitHub Personal Access Token/i
		);
		fireEvent.change( tokenInput, { target: { value: 'invalid_token' } } );

		const saveButton = screen.getByRole( 'button', {
			name: /Save GitHub Token/i,
		} );
		fireEvent.click( saveButton );

		await waitFor( () => {
			expect( setNoticeMock ).toHaveBeenCalledWith( {
				type: 'error',
				message: 'Please enter valid GitHub PAT token.',
			} );
		} );
	} );

	it( 'shows error message returned from API response payload', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce( {
				ok: true,
				json: () => Promise.resolve( { github_token: '' } ),
			} )
			.mockResolvedValueOnce( {
				ok: true,
				json: () =>
					Promise.resolve( {
						status: '400',
						message: 'Custom PAT validation error.',
					} ),
			} ) as typeof fetch;

		render(
			<GitHubRepoToken
				setNotice={ setNoticeMock }
				fetchAllAvailableGitHubRepos={
					fetchAllAvailableGitHubReposMock
				}
			/>
		);

		const tokenInput = await screen.findByLabelText(
			/GitHub Personal Access Token/i
		);
		fireEvent.change( tokenInput, { target: { value: 'bad_token' } } );

		const saveButton = screen.getByRole( 'button', {
			name: /Save GitHub Token/i,
		} );
		fireEvent.click( saveButton );

		await waitFor( () => {
			expect( setNoticeMock ).toHaveBeenCalledWith( {
				type: 'error',
				message: 'Custom PAT validation error.',
			} );
		} );
	} );
} );
