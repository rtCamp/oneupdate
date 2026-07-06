/**
 * External dependencies
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

/**
 * Internal dependencies
 */
import SiteTable from '@/components/SiteTable';
import type { BrandSite } from '@/admin/settings/page';

describe( 'SiteTable', () => {
	const onEditMock = jest.fn();
	const onDeleteMock = jest.fn();
	const setFormDataMock = jest.fn();
	const setShowModalMock = jest.fn();

	const mockSites: BrandSite[] = [
		{
			name: 'Site A',
			url: 'https://sitea.com',
			api_key: 'apikeyabcdefghijklmn',
			gh_repo: 'org/repo-a',
		},
		{
			name: 'Site B',
			url: 'https://siteb.com',
			api_key: 'apikey1234567890',
			gh_repo: 'org/repo-b',
		},
	];

	beforeEach( () => {
		jest.clearAllMocks();
	} );

	it( 'displays "No Brand Sites found." when sites list is empty', () => {
		render(
			<SiteTable
				sites={ [] }
				onEdit={ onEditMock }
				onDelete={ onDeleteMock }
				setFormData={ setFormDataMock }
				setShowModal={ setShowModalMock }
			/>
		);

		expect(
			screen.getByText( /No Brand Sites found./i )
		).toBeInTheDocument();
	} );

	it( 'renders sites list in a table', () => {
		render(
			<SiteTable
				sites={ mockSites }
				onEdit={ onEditMock }
				onDelete={ onDeleteMock }
				setFormData={ setFormDataMock }
				setShowModal={ setShowModalMock }
			/>
		);

		expect( screen.getByText( 'Site A' ) ).toBeInTheDocument();
		expect( screen.getByText( 'https://sitea.com' ) ).toBeInTheDocument();
		expect( screen.getByText( 'org/repo-a' ) ).toBeInTheDocument();
		expect( screen.getByText( 'apikeyabcd...' ) ).toBeInTheDocument();

		expect( screen.getByText( 'Site B' ) ).toBeInTheDocument();
		expect( screen.getByText( 'https://siteb.com' ) ).toBeInTheDocument();
		expect( screen.getByText( 'org/repo-b' ) ).toBeInTheDocument();
		expect( screen.getByText( 'apikey1234...' ) ).toBeInTheDocument();
	} );

	it( 'opens site modal when Add Brand Site is clicked', () => {
		render(
			<SiteTable
				sites={ mockSites }
				onEdit={ onEditMock }
				onDelete={ onDeleteMock }
				setFormData={ setFormDataMock }
				setShowModal={ setShowModalMock }
			/>
		);

		const addButton = screen.getByRole( 'button', {
			name: /Add Brand Site/i,
		} );
		fireEvent.click( addButton );

		expect( setShowModalMock ).toHaveBeenCalledWith( true );
	} );

	it( 'calls callbacks on Edit button click', () => {
		render(
			<SiteTable
				sites={ mockSites }
				onEdit={ onEditMock }
				onDelete={ onDeleteMock }
				setFormData={ setFormDataMock }
				setShowModal={ setShowModalMock }
			/>
		);

		const editButtons = screen.getAllByRole( 'button', { name: /Edit/i } );
		// Click edit for first site
		fireEvent.click( editButtons[ 0 ] as HTMLElement );

		expect( setFormDataMock ).toHaveBeenCalledWith( mockSites[ 0 ] );
		expect( onEditMock ).toHaveBeenCalledWith( 0 );
		expect( setShowModalMock ).toHaveBeenCalledWith( true );
	} );

	it( 'shows and cancels delete confirmation modal', () => {
		render(
			<SiteTable
				sites={ mockSites }
				onEdit={ onEditMock }
				onDelete={ onDeleteMock }
				setFormData={ setFormDataMock }
				setShowModal={ setShowModalMock }
			/>
		);

		const deleteButtons = screen.getAllByRole( 'button', {
			name: /Delete/i,
		} );
		fireEvent.click( deleteButtons[ 0 ] as HTMLElement );

		const dialog = screen.getByRole( 'dialog', {
			name: 'Delete Brand Site',
		} );
		expect(
			within( dialog ).getByText(
				'Are you sure you want to delete this Brand Site? This action cannot be undone.'
			)
		).toBeInTheDocument();

		// Click Cancel
		const cancelButton = within( dialog ).getByRole( 'button', {
			name: /Cancel/i,
		} );
		fireEvent.click( cancelButton );

		// Confirm modal is closed
		expect(
			screen.queryByRole( 'dialog', { name: 'Delete Brand Site' } )
		).not.toBeInTheDocument();
		expect( onDeleteMock ).not.toHaveBeenCalled();
	} );

	it( 'shows delete modal and triggers onDelete callback upon confirming delete', () => {
		render(
			<SiteTable
				sites={ mockSites }
				onEdit={ onEditMock }
				onDelete={ onDeleteMock }
				setFormData={ setFormDataMock }
				setShowModal={ setShowModalMock }
			/>
		);

		const deleteButtons = screen.getAllByRole( 'button', {
			name: /Delete/i,
		} );
		fireEvent.click( deleteButtons[ 1 ] as HTMLElement );

		const dialog = screen.getByRole( 'dialog', {
			name: 'Delete Brand Site',
		} );

		// Confirmation modal delete button
		const confirmDeleteButton = within( dialog ).getByRole( 'button', {
			name: /Delete/i,
		} );
		fireEvent.click( confirmDeleteButton );

		expect( onDeleteMock ).toHaveBeenCalledWith( 1 );
		expect(
			screen.queryByRole( 'dialog', { name: 'Delete Brand Site' } )
		).not.toBeInTheDocument();
	} );
} );
