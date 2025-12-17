/**
 * WordPress dependencies
 */
import {
	Button,
	CardBody,
	Card,
	CardHeader,
	TextControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useCallback, useEffect } from '@wordpress/element';
import type { NoticeType } from '@/admin/settings/page';

const API_NAMESPACE = window.OneUpdateSettings.restUrl + '/oneupdate/v1';
const NONCE = window.OneUpdateSettings.restNonce;

const GitHubRepoToken = (
	{ setNotice, fetchAllAvailableGitHubRepos } :
	{
		setNotice: ( notice: NoticeType ) => void,
		fetchAllAvailableGitHubRepos: () => Promise<void>,
	},
) => {
	const [ repoToken, setRepoToken ] = useState( '' );

	const getRepoToken = useCallback( async () => {
		const response = await fetch(
			`${ API_NAMESPACE }/github-token`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-NONCE': NONCE,
				},
			},
		);

		if ( ! response.ok ) {
			console.error( 'Error fetching GitHub token:', response.statusText ); // eslint-disable-line no-console
		}

		const data = await response.json();

		if ( data?.github_token ) {
			setRepoToken( data.github_token );
		}
	}, [] );

	useEffect( () => {
		getRepoToken();
	}, [] );

	const setGitHubRepoToken = useCallback( async ( token : string ) => {
		const response = await fetch(
			`${ API_NAMESPACE }/github-token`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-NONCE': NONCE,
				},
				body: JSON.stringify( { token } ),
			},
		);

		if ( response.ok === false || response.status === 400 ) {
			setNotice( {
				type: 'error',
				message: __( 'Please enter valid GitHub PAT token.', 'oneupdate' ),
			} );
			return;
		}
		const data = await response.json();

		if ( data?.status === '400' ) {
			setNotice( {
				type: 'error',
				message: data?.message || __( 'Enter valid PAT token.', 'oneupdate' ),
			} );
			return;
		}

		if ( data?.success ) {
			setNotice( {
				type: 'success',
				message: __( 'GitHub token saved successfully.', 'oneupdate' ),
			} );
			await fetchAllAvailableGitHubRepos();
		} else {
			console.error( 'Error setting GitHub token:', data ); // eslint-disable-line no-console
		}
	}, [] );

	return (
		<Card
			style={
				{ marginTop: '20px' }
			}
		>
			<CardHeader>
				<h3>{ __( 'GitHub Credentials', 'oneupdate' ) }</h3>
				<Button
					variant="secondary"
					onClick={ () => {
						setGitHubRepoToken( repoToken );
					} }
					style={ { marginTop: '12px' } }
				>
					{ __( 'Save GitHub Token', 'oneupdate' ) }
				</Button>
			</CardHeader>

			<CardBody>
				<TextControl
					label={ __( 'GitHub Personal Access Token*', 'oneupdate' ) }
					value={ repoToken }
					onChange={ ( value ) => setRepoToken( value ) }
					help={ __( 'Enter your GitHub Personal Access Token to authenticate with the GitHub API. This token should have permissions to access your public/private repositories.', 'oneupdate' ) }
					placeholder={ __( 'ghp_XXXXXXXXXXXXXXXX', 'oneupdate' ) }
					type="password"
					autoComplete="off"
				/>
			</CardBody>
		</Card>

	);
};

export default GitHubRepoToken;
