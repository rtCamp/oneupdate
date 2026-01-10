/**
 * This will have admin related code only.
 */

// Add event listener for search input
const pluginSearchInput = document.getElementById('plugin-search-input');
const pluginTableRows = document.querySelectorAll('#plugin-browser-table tbody tr');

if (pluginSearchInput) {
	pluginSearchInput.addEventListener('input', (event) => {
		const searchTerm = event.target.value.toLowerCase();

		pluginTableRows.forEach((row) => {
			const pluginName = row.querySelector('.plugin-name').textContent.toLowerCase();
			const pluginStatus = row.querySelector('.plugin-status').textContent.toLowerCase();

			if (pluginName.includes(searchTerm) || pluginStatus.includes(searchTerm)) {
				row.style.display = '';
			} else {
				row.style.display = 'none';
			}
		});
	});
}

// Ensure the plugin browser table matches WordPress admin patterns
const pluginTable = document.getElementById('plugin-browser-table');
if (pluginTable) {
	pluginTable.classList.add('wp-list-table', 'widefat', 'fixed', 'striped');
}
