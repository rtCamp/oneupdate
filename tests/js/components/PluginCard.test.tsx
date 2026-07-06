/**
 * External dependencies
 */
import { fireEvent, render, screen } from '@testing-library/react';
/**
 * Internal dependencies
 */
import PluginCard from '@/components/PluginCard';

const mockPlugin = {
	name: 'My Custom Plugin',
	slug: 'my-custom-plugin',
	version: '1.2.3',
	short_description: 'This is a test description of the plugin.',
	icons: {
		'1x': 'https://example.com/icon.png',
		default: 'https://example.com/icon-default.png',
	},
	versions: {
		'1.0.0':
			'https://downloads.wordpress.org/plugin/my-custom-plugin.1.0.0.zip',
		'1.1.0':
			'https://downloads.wordpress.org/plugin/my-custom-plugin.1.1.0.zip',
		'1.2.0':
			'https://downloads.wordpress.org/plugin/my-custom-plugin.1.2.0.zip',
		'1.2.1':
			'https://downloads.wordpress.org/plugin/my-custom-plugin.1.2.1.zip',
		'1.2.2-beta':
			'https://downloads.wordpress.org/plugin/my-custom-plugin.1.2.2-beta.zip',
		'1.2.3':
			'https://downloads.wordpress.org/plugin/my-custom-plugin.1.2.3.zip',
		trunk: 'https://downloads.wordpress.org/plugin/my-custom-plugin.zip',
	},
};

describe( 'PluginCard', () => {
	const onSelectMock = jest.fn();
	const onVersionChangeMock = jest.fn();

	beforeEach( () => {
		onSelectMock.mockReset();
		onVersionChangeMock.mockReset();
	} );

	it( 'renders plugin details correctly when not selected', () => {
		render(
			<PluginCard
				plugin={ mockPlugin }
				selectedPlugin={ [] }
				onSelect={ onSelectMock }
				onVersionChange={ onVersionChangeMock }
			/>
		);

		expect(
			screen.getByRole( 'heading', { name: 'My Custom Plugin' } )
		).toBeInTheDocument();
		expect(
			screen.getByText( 'This is a test description of the plugin.' )
		).toBeInTheDocument();
		expect( screen.getByText( 'v1.2.3' ) ).toBeInTheDocument();

		const logo = screen.getByRole( 'img', { name: 'My Custom Plugin' } );
		expect( logo ).toHaveAttribute( 'src', 'https://example.com/icon.png' );

		const selectButton = screen.getByRole( 'button', {
			name: 'Select Plugin',
		} );
		expect( selectButton ).toBeInTheDocument();
		expect( screen.queryByLabelText( 'Version' ) ).not.toBeInTheDocument();
	} );

	it( 'renders selected state and version select dropdown when selected', () => {
		const selectedPlugin = [
			{
				slug: 'my-custom-plugin',
				version: '1.2.3',
			},
		];

		render(
			<PluginCard
				plugin={ mockPlugin }
				selectedPlugin={ selectedPlugin }
				onSelect={ onSelectMock }
				onVersionChange={ onVersionChangeMock }
			/>
		);

		const selectedButton = screen.getByRole( 'button', {
			name: 'Selected',
		} );
		expect( selectedButton ).toBeInTheDocument();

		const versionSelect = screen.getByLabelText(
			'Version'
		) as HTMLSelectElement;
		expect( versionSelect ).toBeInTheDocument();
		expect( versionSelect.value ).toBe( '1.2.3' );

		// Options should be the last 5 stable versions (1.2.3, 1.2.1, 1.2.0, 1.1.0, 1.0.0) in reverse.
		// It should exclude '1.2.2-beta' and 'trunk'.
		const options = Array.from( versionSelect.options ).map(
			( opt ) => opt.value
		);
		expect( options ).toEqual( [
			'1.2.3',
			'1.2.1',
			'1.2.0',
			'1.1.0',
			'1.0.0',
		] );
	} );

	it( 'calls onSelect with version when clicked to select', () => {
		render(
			<PluginCard
				plugin={ mockPlugin }
				selectedPlugin={ [] }
				onSelect={ onSelectMock }
				onVersionChange={ onVersionChangeMock }
			/>
		);

		const selectButton = screen.getByRole( 'button', {
			name: 'Select Plugin',
		} );
		fireEvent.click( selectButton );

		expect( onSelectMock ).toHaveBeenCalledWith(
			'my-custom-plugin',
			'1.2.3'
		);
	} );

	it( 'calls onSelect with null when clicked to deselect', () => {
		const selectedPlugin = [
			{
				slug: 'my-custom-plugin',
				version: '1.2.3',
			},
		];

		render(
			<PluginCard
				plugin={ mockPlugin }
				selectedPlugin={ selectedPlugin }
				onSelect={ onSelectMock }
				onVersionChange={ onVersionChangeMock }
			/>
		);

		const selectedButton = screen.getByRole( 'button', {
			name: 'Selected',
		} );
		fireEvent.click( selectedButton );

		expect( onSelectMock ).toHaveBeenCalledWith( 'my-custom-plugin', null );
	} );

	it( 'calls onVersionChange when a different version is selected', () => {
		const selectedPlugin = [
			{
				slug: 'my-custom-plugin',
				version: '1.2.3',
			},
		];

		render(
			<PluginCard
				plugin={ mockPlugin }
				selectedPlugin={ selectedPlugin }
				onSelect={ onSelectMock }
				onVersionChange={ onVersionChangeMock }
			/>
		);

		const versionSelect = screen.getByLabelText( 'Version' );
		fireEvent.change( versionSelect, { target: { value: '1.2.0' } } );

		expect( onVersionChangeMock ).toHaveBeenCalledWith(
			'my-custom-plugin',
			'1.2.0'
		);
	} );
} );
