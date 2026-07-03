/**
 * WordPress dependencies
 */
import {
	Button,
	CardBody,
	Card,
	CardHeader,
	TextControl,
	__experimentalGrid as Grid,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useCallback, useEffect } from '@wordpress/element';
/**
 * Internal dependencies
 */
import { isValidUrl } from '../js/utils';
/**
 * External dependencies
 */
import type { NoticeType } from '@/admin/settings/page';

const API_NAMESPACE = window.OneUpdateSettings.restUrl + '/oneupdate/v1';
const NONCE = window.OneUpdateSettings.restNonce;

interface S3CredentialsType {
	accessKey: string;
	secretKey: string;
	bucketName: string;
	region: string;
	endpoint: string;
}

const defaultS3Credentials: S3CredentialsType = {
	accessKey: '',
	secretKey: '',
	bucketName: '',
	region: '',
	endpoint: '',
};

const S3Credentials = ( {
	setNotice,
}: {
	setNotice: ( notice: NoticeType ) => void;
} ) => {
	const [ s3Credentials, setS3Credentials ] =
		useState< S3CredentialsType >( defaultS3Credentials );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ isLoading, setIsLoading ] = useState( true );

	const getS3Credentials = useCallback( async () => {
		const response = await fetch( `${ API_NAMESPACE }/s3-credentials`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-NONCE': NONCE,
			},
		} );

		if ( ! response.ok ) {
			setNotice( {
				type: 'error',
				message: __( 'Failed to fetch S3 credentials.', 'oneupdate' ),
			} );
			return;
		}

		const data = await response.json();
		if ( data?.s3_credentials ) {
			setS3Credentials( data.s3_credentials );
		}
		setIsLoading( false );
	}, [] );

	useEffect( () => {
		getS3Credentials();
	}, [] );

	const saveS3Credentials = useCallback( async () => {
		setIsSaving( true );

		// before saving add validation for required fields
		if (
			! s3Credentials.bucketName ||
			! s3Credentials.region ||
			! s3Credentials.endpoint ||
			! s3Credentials.accessKey ||
			! s3Credentials.secretKey
		) {
			setNotice( {
				type: 'error',
				message: __(
					'All fields are required to save S3 credentials.',
					'oneupdate'
				),
			} );
			setIsSaving( false );
			return;
		}

		if ( ! isValidUrl( s3Credentials.endpoint ) ) {
			setNotice( {
				type: 'error',
				message: __(
					'Please enter a valid URL for the S3 endpoint.',
					'oneupdate'
				),
			} );
			setIsSaving( false );
			return;
		}

		const response = await fetch( `${ API_NAMESPACE }/s3-credentials`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-NONCE': NONCE,
			},
			body: JSON.stringify( { s3_credentials: s3Credentials } ),
		} );

		if ( ! response.ok ) {
			setNotice( {
				type: 'error',
				message: __(
					'Failed to save S3 credentials. Please try again later.',
					'oneupdate'
				),
			} );
			setIsSaving( false );
			return;
		}

		const data = await response.json();
		if ( data?.success ) {
			setNotice( {
				type: 'success',
				message: __(
					'S3 credentials saved successfully.',
					'oneupdate'
				),
			} );
		} else {
			setNotice( {
				type: 'error',
				message: __(
					'Failed to save S3 credentials. Please try again later.',
					'oneupdate'
				),
			} );
		}
		setIsSaving( false );
	}, [ s3Credentials, setNotice ] );

	return (
		<Card style={ { marginTop: '20px' } }>
			<CardHeader>
				<h2>{ __( 'S3 Credentials', 'oneupdate' ) }</h2>
				<Button
					style={ { marginTop: '12px' } }
					variant="secondary"
					isBusy={ isSaving }
					onClick={ saveS3Credentials }
				>
					{ __( 'Save Credentials', 'oneupdate' ) }
				</Button>
			</CardHeader>
			<CardBody>
				{ isLoading ? (
					<p>{ __( 'Loading…', 'oneupdate' ) }</p>
				) : (
					<>
						<Grid columns={ 3 }>
							<TextControl
								label={ __( 'Bucket Name*', 'oneupdate' ) }
								value={ s3Credentials.bucketName }
								onChange={ ( value ) =>
									setS3Credentials( {
										...s3Credentials,
										bucketName: value,
									} )
								}
								placeholder={ __(
									'Enter your S3 Bucket Name',
									'oneupdate'
								) }
								help={ __(
									'The name of your S3 bucket where files will be uploaded.',
									'oneupdate'
								) }
							/>
							<TextControl
								label={ __( 'Region*', 'oneupdate' ) }
								value={ s3Credentials.region }
								onChange={ ( value ) =>
									setS3Credentials( {
										...s3Credentials,
										region: value,
									} )
								}
								placeholder={ __(
									'Enter your S3 Region',
									'oneupdate'
								) }
								help={ __(
									'The AWS region where your S3 bucket is located.',
									'oneupdate'
								) }
							/>
							<TextControl
								type="url"
								label={ __( 'Endpoint*', 'oneupdate' ) }
								value={ s3Credentials.endpoint }
								onChange={ ( value ) =>
									setS3Credentials( {
										...s3Credentials,
										endpoint: value,
									} )
								}
								placeholder={ __(
									'Enter your S3 Endpoint',
									'oneupdate'
								) }
								help={ __(
									'The custom endpoint for your S3 bucket.',
									'oneupdate'
								) }
							/>
							<TextControl
								label={ __( 'Access Key*', 'oneupdate' ) }
								value={ s3Credentials.accessKey }
								onChange={ ( value ) =>
									setS3Credentials( {
										...s3Credentials,
										accessKey: value,
									} )
								}
								placeholder={ __(
									'Enter your S3 Access Key',
									'oneupdate'
								) }
								help={ __(
									'Your S3 Access Key ID will go here…',
									'oneupdate'
								) }
								type="password"
							/>
							<TextControl
								label={ __( 'Secret Key*', 'oneupdate' ) }
								type="password"
								value={ s3Credentials.secretKey }
								onChange={ ( value ) =>
									setS3Credentials( {
										...s3Credentials,
										secretKey: value,
									} )
								}
								placeholder={ __(
									'Enter your S3 Secret',
									'oneupdate'
								) }
								help={ __(
									'Your S3 Secret Access Key will go here…',
									'oneupdate'
								) }
							/>
						</Grid>
					</>
				) }
			</CardBody>
		</Card>
	);
};

export default S3Credentials;
