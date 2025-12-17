/**
 * WordPress dependencies
 */
import { useState } from 'react';
import { Button, Card, CardHeader, CardBody, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import type { BrandSite, EditingIndex } from '@/admin/settings/page';

const SiteTable = (
	{ sites, onEdit, onDelete, setFormData, setShowModal } :
	{
		sites: BrandSite[];
		onEdit: ( index: number ) => void;
		onDelete: ( index: number|null ) => void;
		setFormData: ( data: BrandSite ) => void;
		setShowModal: ( show: boolean ) => void;
	},
) => {
	const [ showDeleteModal, setShowDeleteModal ] = useState( false );
	const [ deleteIndex, setDeleteIndex ] = useState< EditingIndex >( null );

	const handleDeleteClick = ( index:number ) => {
		setDeleteIndex( index );
		setShowDeleteModal( true );
	};

	const handleDeleteConfirm = () => {
		onDelete( deleteIndex );
		setShowDeleteModal( false );
		setDeleteIndex( null );
	};

	const handleDeleteCancel = () => {
		setShowDeleteModal( false );
		setDeleteIndex( null );
	};

	return (
		<Card style={ { marginTop: '30px' } }>
			<CardHeader>
				<h3>{ __( 'Brand Sites', 'oneupdate' ) }</h3>
				<Button
					style={ { width: 'fit-content' } }
					variant="primary"
					onClick={ () => setShowModal( true ) }
				>
					{ __( 'Add Brand Site', 'oneupdate' ) }
				</Button>
			</CardHeader>
			<CardBody>
				<table className="wp-list-table widefat fixed striped " style={ { marginTop: '16px' } }>
					<thead>
						<tr>
							<th>{ __( 'Site Name', 'oneupdate' ) }</th>
							<th>{ __( 'Site URL', 'oneupdate' ) }</th>
							<th>{ __( 'GitHub Repo', 'oneupdate' ) }</th>
							<th>{ __( 'API Key', 'oneupdate' ) }</th>
							<th>{ __( 'Actions', 'oneupdate' ) }</th>
						</tr>
					</thead>
					<tbody>
						{ sites.length === 0 && (
							<tr>
								<td colSpan={ 5 } style={ { textAlign: 'center' } }>
									{ __( 'No Brand Sites found.', 'oneupdate' ) }
								</td>
							</tr>
						) }
						{ sites?.map( ( site, index ) => (
							<tr key={ index }>
								<td>{ site?.name }</td>
								<td>{ site?.url }</td>
								<td>{ site?.gh_repo }</td>
								<td><code>{ site?.api_key?.substring( 0, 10 ) }...</code></td>
								<td>
									<Button
										variant="secondary"
										onClick={ () => {
											setFormData( site );
											onEdit( index );
											setShowModal( true );
										} }
										style={ { marginRight: '8px' } }
									>
										{ __( 'Edit', 'oneupdate' ) }
									</Button>
									<Button
										variant="secondary"
										isDestructive
										onClick={ () => handleDeleteClick( index ) }
									>
										{ __( 'Delete', 'oneupdate' ) }
									</Button>
								</td>
							</tr>
						) ) }
					</tbody>
				</table>
			</CardBody>
			{ showDeleteModal && (
				<DeleteConfirmationModal
					onConfirm={ handleDeleteConfirm }
					onCancel={ handleDeleteCancel }
				/>
			) }
		</Card>
	);
};

const DeleteConfirmationModal = (
	{ onConfirm, onCancel }
	: { onConfirm: () => void; onCancel: () => void },
) => (
	<Modal
		title={ __( 'Delete Brand Site', 'oneupdate' ) }
		onRequestClose={ onCancel }
		isDismissible={ true }
		shouldCloseOnClickOutside={ true }
	>
		<p>{ __( 'Are you sure you want to delete this Brand Site? This action cannot be undone.', 'oneupdate' ) }</p>
		<div style={ { display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '16px' } }>
			<Button
				variant="secondary"
				onClick={ onCancel }
			>
				{ __( 'Cancel', 'oneupdate' ) }
			</Button>
			<Button
				variant="primary"
				isDestructive
				onClick={ onConfirm }
			>
				{ __( 'Delete', 'oneupdate' ) }
			</Button>
		</div>
	</Modal>
);

export default SiteTable;
