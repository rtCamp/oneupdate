/**
 * WordPress dependencies
 */
import {
	useState,
	useEffect,
	useCallback,
	createRoot,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Card,
	CardHeader,
	CardBody,
	Button,
	SelectControl,
	TextControl,
	Modal,
	Spinner,
	DropdownMenu,
	__experimentalGrid as Grid,
	Snackbar,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import { moreVertical } from '@wordpress/icons';
/**
 * Internal dependencies
 */
import ViewIcon from '../../components/icons/View';

const API_NAMESPACE =
	window.OneUpdatePullRequests.restUrl + '/oneupdate/v1/github';
const NONCE = window.OneUpdatePullRequests.restNonce;
const REPOS = window.OneUpdatePullRequests.repos;

const PER_PAGE = 25;
const PR_LABEL_STYLES = {
	display: 'inline-block',
	padding: '2px 6px',
	borderRadius: '3px',
	fontSize: '11px',
	backgroundColor: `#1c1c1c`,
	color: '#fff',
};

const GitHubPullRequests = () => {
	const [ pullRequests, setPullRequests ] = useState( [] );
	const [ loading, setLoading ] = useState( false );
	const [ notice, setNotice ] = useState( null );
	const [ selectedRepo, setSelectedRepo ] = useState(
		Object.keys( REPOS )?.[ 0 ] || ''
	);
	const [ statusFilter, setStatusFilter ] = useState( 'all' );
	const [ searchQuery, setSearchQuery ] = useState( '[OneUpdate]' );
	const [ page, setPage ] = useState( 1 );
	const [ totalPages, setTotalPages ] = useState( 1 );
	const [ selectedPR, setSelectedPR ] = useState( null );
	const [ isDetailModalOpen, setIsDetailModalOpen ] = useState( false );
	const [ prDetails, setPrDetails ] = useState( null );
	const [ detailsLoading, setDetailsLoading ] = useState( false );
	const [ currentPage, setCurrentPage ] = useState( 1 );

	// Repo options for SelectControl
	const repoOptions = Object.entries( REPOS ).map( ( [ key, value ] ) => ( {
		label: `${ value } (${ key })`,
		value: key,
	} ) );

	// Status filter options
	const statusOptions = [
		{ label: __( 'All Status', 'oneupdate' ), value: 'all' },
		{ label: __( 'Open', 'oneupdate' ), value: 'open' },
		{ label: __( 'Merged/Closed', 'oneupdate' ), value: 'closed' },
	];

	const fetchPullRequests = useCallback( async () => {
		if ( ! selectedRepo ) {
			return;
		}

		setLoading( true );
		setNotice( null );

		try {
			const params = new URLSearchParams( {
				per_page: PER_PAGE.toString(),
				page: page.toString(),
				state: statusFilter,
			} );

			if ( searchQuery.trim() ) {
				params.append( 'search_query', searchQuery.trim() );
			}

			const response = await fetch(
				`${ API_NAMESPACE }/pull-requests/${ selectedRepo }?${ params.toString() }&_=${ new Date().getTime() }`,
				{
					headers: {
						'Content-Type': 'application/json',
						'X-WP-NONCE': NONCE,
					},
				}
			);

			if ( ! response.ok ) {
				if ( response?.statusText === 'Unprocessable Entity' ) {
					setNotice( {
						type: 'error',
						message: __(
							'Please enter valid character to search pull requests.',
							'oneupdate'
						),
					} );
				} else {
					setNotice( {
						type: 'error',
						message: __(
							'Failed to fetch pull requests.',
							'oneupdate'
						),
					} );
				}
				return;
			}

			const data = await response.json();

			if ( data.success ) {
				setPullRequests( data.pull_requests || [] );
				// Calculate total pages based on response (you might need to adjust based on your API)
				const totalCount =
					response.headers.get( 'X-WP-Total' ) ||
					data.pull_requests.length;
				setTotalPages( Math.ceil( totalCount / PER_PAGE ) );
				setCurrentPage( data?.pagination?.current_page || 1 );
			} else {
				setNotice( {
					type: 'error',
					message: __( 'Error fetching pull requests.', 'oneupdate' ),
				} );
			}
		} catch ( error ) {
			setNotice( {
				type: 'error',
				message:
					error.message ||
					__( 'Error fetching pull requests.', 'oneupdate' ),
			} );
			setPullRequests( [] );
		} finally {
			setLoading( false );
		}
	}, [ selectedRepo, statusFilter, searchQuery, page ] );

	const fetchPRDetails = useCallback(
		async ( prNumber ) => {
			if ( ! selectedRepo || ! prNumber ) {
				return;
			}

			setDetailsLoading( true );
			try {
				const response = await fetch(
					`${ API_NAMESPACE }/pull-requests/${ selectedRepo }?pr_number=${ prNumber }&_=${ new Date().getTime() }`,
					{
						headers: {
							'Content-Type': 'application/json',
							'X-WP-NONCE': NONCE,
						},
					}
				);

				if ( ! response.ok ) {
					throw new Error( 'Failed to fetch PR details' );
				}

				const data = await response.json();

				if ( data.success && data.pull_request?.[ 0 ] ) {
					setPrDetails( data.pull_request[ 0 ] );
				} else {
					throw new Error( 'Failed to fetch PR details' );
				}
			} catch ( error ) {
				setNotice( {
					type: 'error',
					message:
						error.message ||
						__( 'Error fetching PR details.', 'oneupdate' ),
				} );
			} finally {
				setDetailsLoading( false );
			}
		},
		[ selectedRepo ]
	);

	const openDetailModal = ( pr ) => {
		setSelectedPR( pr );
		setIsDetailModalOpen( true );
		fetchPRDetails( pr.number );
	};

	const closeModals = () => {
		setIsDetailModalOpen( false );
		setSelectedPR( null );
		setPrDetails( null );
	};

	const formatDate = ( dateString ) => {
		if ( ! dateString ) {
			return __( 'N/A', 'oneupdate' );
		}
		return new Date( dateString ).toLocaleString();
	};

	const getPRStatusBadge = ( pr ) => {
		let status = pr.state;
		let color = '#6b7280';

		if ( pr.merged_at ) {
			status = 'merged';
			color = '#7c3aed';
		} else if ( pr.state === 'open' ) {
			color = '#059669';
		} else if ( pr.state === 'closed' ) {
			color = '#dc2626';
		}

		return (
			<span
				style={ {
					display: 'inline-block',
					padding: '2px 8px',
					borderRadius: '4px',
					fontSize: '12px',
					fontWeight: '500',
					backgroundColor: color,
					color: '#fff',
					textTransform: 'capitalize',
				} }
			>
				{ status }
			</span>
		);
	};

	const renderPRActions = ( pr ) => {
		return (
			<DropdownMenu
				icon={ moreVertical }
				label={ __( 'PR Actions', 'oneupdate' ) }
				popoverProps={ { position: 'bottom left' } }
				className="oneupdate-pr-actions"
			>
				{ ( { onClose } ) => {
					return (
						<>
							<MenuGroup>
								{ pr.state === 'open' && (
									<>
										<MenuItem
											icon={ <ViewIcon /> }
											onClick={ () => {
												openDetailModal( pr );
												onClose();
											} }
										>
											{ __(
												'View Details',
												'oneupdate'
											) }
										</MenuItem>
									</>
								) }
							</MenuGroup>
							{ pr.state !== 'open' && (
								<MenuGroup>
									<MenuItem
										icon={ <ViewIcon /> }
										onClick={ () => {
											openDetailModal( pr );
											onClose();
										} }
									>
										{ __( 'View Details', 'oneupdate' ) }
									</MenuItem>
								</MenuGroup>
							) }
						</>
					);
				} }
			</DropdownMenu>
		);
	};

	// Reset page when filters change
	useEffect( () => {
		setPage( 1 );
	}, [ selectedRepo, statusFilter, searchQuery ] );

	// Fetch PRs when dependencies change
	useEffect( () => {
		fetchPullRequests();
	}, [ fetchPullRequests ] );

	return (
		<>
			<Card style={ { marginTop: '30px' } }>
				<CardHeader>
					<h2>{ __( 'GitHub Pull Requests', 'oneupdate' ) }</h2>
				</CardHeader>
				<CardBody>
					{ /* Filters */ }
					<Grid
						columns="3"
						gap="4"
						style={ {
							alignItems: 'flex-end',
							marginBottom: '20px',
							justifyContent: 'space-between',
						} }
					>
						<TextControl
							label={ __( 'Search', 'oneupdate' ) }
							placeholder={ __(
								'Search by title, number…',
								'oneupdate'
							) }
							value={ searchQuery }
							onChange={ setSearchQuery }
						/>
						<>
							<SelectControl
								label={ __( 'Brand Sites', 'oneupdate' ) }
								value={ selectedRepo }
								options={ repoOptions }
								onChange={ setSelectedRepo }
							/>
							<SelectControl
								label={ __( 'Status', 'oneupdate' ) }
								value={ statusFilter }
								options={ statusOptions }
								onChange={ setStatusFilter }
							/>
						</>
					</Grid>

					{ /* PR Table */ }
					<table className="wp-list-table widefat fixed striped">
						<thead>
							<tr>
								<th style={ { width: '8%' } }>
									{ __( 'PR #', 'oneupdate' ) }
								</th>
								<th style={ { width: '35%' } }>
									{ __( 'Title', 'oneupdate' ) }
								</th>
								<th style={ { width: '12%' } }>
									{ __( 'Author', 'oneupdate' ) }
								</th>
								<th style={ { width: '8%' } }>
									{ __( 'Status', 'oneupdate' ) }
								</th>
								<th style={ { width: '15%' } }>
									{ __( 'Created at', 'oneupdate' ) }
								</th>
								<th style={ { width: '15%' } }>
									{ __( 'Labels', 'oneupdate' ) }
								</th>
								<th style={ { width: '7%' } }>
									{ __( 'Actions', 'oneupdate' ) }
								</th>
							</tr>
						</thead>
						<tbody>
							{ loading && (
								<tr>
									<td
										colSpan="7"
										style={ {
											textAlign: 'center',
											padding: '20px',
										} }
									>
										<Spinner
											style={ {
												width: '40px',
												height: '40px',
											} }
										/>
									</td>
								</tr>
							) }
							{ ! loading && pullRequests.length === 0 && (
								<tr>
									<td
										colSpan="7"
										style={ { textAlign: 'center' } }
									>
										{ __(
											'No pull requests found.',
											'oneupdate'
										) }
									</td>
								</tr>
							) }
							{ pullRequests.map( ( pr ) => (
								<tr key={ pr.id }>
									<td>
										<span
											style={ {
												textDecoration: 'none',
												fontWeight: 'bold',
											} }
										>
											#{ pr.number }
										</span>
									</td>
									<td>
										<a
											href={ pr.html_url }
											target="_blank"
											rel="noopener noreferrer"
										>
											<strong>
												{ decodeEntities( pr.title ) }
											</strong>
										</a>
									</td>
									<td>
										<div
											style={ {
												display: 'flex',
												alignItems: 'center',
												gap: '8px',
											} }
										>
											<img
												src={ pr.user.avatar_url }
												alt={ pr.user.login }
												style={ {
													width: '24px',
													height: '24px',
													borderRadius: '50%',
												} }
											/>
											<span>{ pr.user.login }</span>
										</div>
									</td>
									<td>{ getPRStatusBadge( pr ) }</td>
									<td>{ formatDate( pr.created_at ) }</td>
									<td>
										{ pr.labels.length > 0 ? (
											<div
												style={ {
													display: 'flex',
													flexWrap: 'wrap',
													gap: '4px',
												} }
											>
												{ pr.labels
													.slice( 0, 2 )
													.map( ( label ) => (
														<span
															key={ label.id }
															style={
																PR_LABEL_STYLES
															}
														>
															{ label.name }
														</span>
													) ) }
												{ pr.labels.length > 2 && (
													<span
														style={ {
															fontSize: '11px',
															color: '#6b7280',
														} }
													>
														+
														{ pr.labels.length - 2 }{ ' ' }
														{ __(
															'more',
															'oneupdate'
														) }
													</span>
												) }
											</div>
										) : (
											<span
												style={ {
													color: '#6b7280',
													fontSize: '12px',
												} }
											>
												{ __(
													'No labels',
													'oneupdate'
												) }
											</span>
										) }
									</td>
									<td>{ renderPRActions( pr ) }</td>
								</tr>
							) ) }
						</tbody>
					</table>

					{ /* Pagination */ }
					<div
						style={ {
							marginTop: '16px',
							display: 'flex',
							justifyContent: 'center',
						} }
					>
						<Button
							variant="secondary"
							onClick={ () =>
								setPage( ( prev ) => Math.max( prev - 1, 1 ) )
							}
							disabled={ page === 1 }
							style={ { marginRight: '8px' } }
						>
							{ __( 'Previous', 'oneupdate' ) }
						</Button>
						<span style={ { alignSelf: 'center' } }>
							{ __( 'Page', 'oneupdate' ) } { page }{ ' ' }
							{ __( 'of', 'oneupdate' ) }{ ' ' }
							{ totalPages === 0 || totalPages < currentPage
								? currentPage
								: totalPages }
						</span>
						<Button
							variant="secondary"
							onClick={ () =>
								setPage( ( prev ) =>
									Math.min( prev + 1, totalPages )
								)
							}
							disabled={ page >= totalPages }
							style={ { marginLeft: '8px' } }
						>
							{ __( 'Next', 'oneupdate' ) }
						</Button>
					</div>
				</CardBody>
			</Card>

			{ /* PR Details Modal */ }
			{ isDetailModalOpen && selectedPR && (
				<Modal
					title={ __( 'Pull Request Details', 'oneupdate' ) }
					onRequestClose={ closeModals }
					size="medium"
					shouldCloseOnClickOutside
				>
					{ /* Detailed PR Info */ }
					{ detailsLoading && (
						<div
							style={ { textAlign: 'center', margin: '20px 0' } }
						>
							<Spinner
								style={ { width: '40px', height: '40px' } }
							/>
							<p>{ __( 'Loading PR details…', 'oneupdate' ) }</p>
						</div>
					) }

					{ ! detailsLoading && prDetails && (
						<>
							<div style={ { marginBottom: '20px' } }>
								<div
									style={ {
										display: 'grid',
										gridTemplateColumns: 'repeat(2, 1fr)',
										gap: '16px',
									} }
								>
									<div>
										<p>
											<strong>
												{ __(
													'PR Number:',
													'oneupdate'
												) }
											</strong>{ ' ' }
											#{ prDetails.number }
										</p>
										<p>
											<strong>
												{ __( 'Title:', 'oneupdate' ) }
											</strong>{ ' ' }
											{ decodeEntities(
												prDetails.title
											) }
										</p>
										<p>
											<strong>
												{ __( 'Author:', 'oneupdate' ) }
											</strong>{ ' ' }
											{ prDetails.user.login }
										</p>
										<p>
											<strong>
												{ __( 'Status:', 'oneupdate' ) }
											</strong>{ ' ' }
											{ getPRStatusBadge( prDetails ) }
										</p>
									</div>
									<div>
										<p>
											<strong>
												{ __(
													'Created:',
													'oneupdate'
												) }
											</strong>{ ' ' }
											{ formatDate(
												prDetails.created_at
											) }
										</p>
										<p>
											<strong>
												{ __(
													'Updated:',
													'oneupdate'
												) }
											</strong>{ ' ' }
											{ formatDate(
												prDetails.updated_at
											) }
										</p>
										<p>
											<strong>
												{ __( 'Branch:', 'oneupdate' ) }
											</strong>{ ' ' }
											{ prDetails.pr_branch } →{ ' ' }
											{ prDetails.base_branch }
										</p>
										<p>
											<strong>
												{ __(
													'GitHub URL:',
													'oneupdate'
												) }
											</strong>{ ' ' }
											<a
												href={ prDetails.html_url }
												target="_blank"
												rel="noopener noreferrer"
											>
												{ __(
													'View on GitHub',
													'oneupdate'
												) }
											</a>
										</p>
									</div>
								</div>

								{ /* Labels */ }
								{ prDetails.labels.length > 0 && (
									<div style={ { marginTop: '16px' } }>
										<strong>
											{ __( 'Labels:', 'oneupdate' ) }
										</strong>
										<div
											style={ {
												display: 'flex',
												flexWrap: 'wrap',
												gap: '4px',
												marginTop: '8px',
											} }
										>
											{ prDetails.labels.map(
												( label ) => (
													<span
														key={ label.id }
														style={
															PR_LABEL_STYLES
														}
													>
														{ label.name }
													</span>
												)
											) }
										</div>
									</div>
								) }

								{ /* Description */ }
								{ prDetails.body && (
									<div style={ { marginTop: '16px' } }>
										<strong>
											{ __(
												'Description:',
												'oneupdate'
											) }
										</strong>
										<div
											style={ {
												marginTop: '8px',
												padding: '12px',
												backgroundColor: '#f9f9f9',
												border: '1px solid #ddd',
												borderRadius: '4px',
												maxHeight: '200px',
												overflow: 'auto',
											} }
										>
											<pre
												style={ {
													whiteSpace: 'pre-wrap',
													margin: 0,
													fontSize: '14px',
												} }
											>
												{ decodeEntities(
													prDetails.body
												) }
											</pre>
										</div>
									</div>
								) }
							</div>

							{ /* Merged By Info */ }
							{ prDetails.merged_by && (
								<div
									style={ {
										marginTop: '20px',
										borderTop: '1px solid #ddd',
										paddingTop: '20px',
									} }
								>
									{ prDetails.merged_by && (
										<div style={ { marginTop: '10px' } }>
											<strong>
												{ __(
													'Merged By:',
													'oneupdate'
												) }
											</strong>
											<img
												src={
													prDetails.merged_by
														.avatar_url
												}
												alt={
													prDetails.merged_by.login
												}
												style={ {
													width: '24px',
													height: '24px',
													borderRadius: '50%',
													marginLeft: '8px',
													verticalAlign: 'middle',
												} }
											/>
											<span
												style={ {
													marginLeft: '8px',
													verticalAlign: 'middle',
												} }
											>
												{ prDetails.merged_by.login }
											</span>
										</div>
									) }
								</div>
							) }
						</>
					) }
				</Modal>
			) }

			{ /* Notice Snackbar */ }
			{ notice?.message && (
				<Snackbar
					isDismissible
					status={ notice.type }
					onRemove={ () => setNotice( null ) }
					className={
						notice?.type === 'error'
							? 'oneupdate-error-notice'
							: 'oneupdate-success-notice'
					}
				>
					{ notice.message }
				</Snackbar>
			) }
		</>
	);
};

// Render to Gutenberg admin page with ID: oneupdate-pull-requests
const target = document.getElementById( 'oneupdate-pull-requests' );
if ( target ) {
	const root = createRoot( target );
	root.render( <GitHubPullRequests /> );
}
