=== OneUpdate ===
Contributors: Utsav Patel, rtCamp
Donate link: https://rtcamp.com/
Tags: plugin manager, CI/CD, automation, enterprise
Requires at least: 6.5
Tested up to: 6.8
Stable tag: 1.0.0
Requires PHP: 8.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Centralized plugin management for WordPress sites via CI/CD. Automate updates across development, staging, and production environments.

== Description ==

OneUpdate is a powerful plugin management solution designed for enterprises managing multiple WordPress sites through CI/CD workflows like GitHub, GitLab, or Bitbucket. It streamlines plugin updates, installations, and management across multiple environments by automatically creating pull requests for all changes.

**Why OneUpdate?**

Managing plugin updates across multiple websites in enterprise environments is time-consuming and repetitive. When updates need to flow through multiple environments (develop → staging → production), developers must create separate pull requests for each environment—a tedious workflow.

OneUpdate solves this by providing a centralized governing to manage all sites while automatically creating pull requests for all environments, maintaining proper Git history without commit conflicts.

**Key Benefits:**

* **50% Time Savings:** Reduce plugin update process time significantly
* **Cost Reduction:** Lower operational costs through workflow optimization  
* **Streamlined Workflow:** Centralized management while maintaining site autonomy
* **Security:** REST API with unique authentication keys and secure S3 integration

**Core Features:**

* **Dual Architecture Support:** Works with WordPress multisite and standalone installations
* **Secure API Integration:** REST API with unique authentication keys for safe operations
* **Plugin Browser:** Full-screen admin interface with search and filtering functionality
* **Status Monitoring:** Visual indicators for plugin states (active, update available, deactivated)
* **Version Control:** Install specific versions from the latest 5 available releases
* **Private Plugin Support:** Upload and manage proprietary plugins with S3 integration
* **Bulk Operations:** Update all plugins across multiple sites simultaneously
* **Automated PR Creation:** Generate pull requests for all changes across environments

**Plugin Management Actions:**

* Activate/Deactivate plugins on selected sites
* Update plugins to specific versions (latest 5 versions available)
* Install new plugins from WordPress.org repository
* Upload and manage private plugins (expires after 1 hour for security)
* Bulk update all available plugins
* Remove plugins from specific sites
* Real-time plugin status tracking

**Perfect for:**

* Enterprise WordPress deployments
* Development teams using CI/CD workflows
* Agencies managing multiple client sites
* Organizations with strict deployment processes
* Sites hosted on platforms like WordPress VIP

== Installation ==

1. Upload the OneUpdate plugin files to the `/wp-content/plugins/oneupdate` directory, or install the plugin through the WordPress plugins screen directly
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Set up one site as the "Governing Site" for centralized management
4. Configure other sites as "Brand Sites" 
5. Add required GitHub Actions workflows to your repositories:
   * `oneupdate-pr-creation.yml` (for public plugins)
   * `oneupdate-pr-creation-private.yml` (for private plugins)
6. Configure GitHub PAT token and S3 credentials in the Governing Site
7. Register all Brand Sites with their respective API keys

== Frequently Asked Questions ==

= How are plugins managed? =

Plugins are managed using a combination of GitHub Actions and WordPress REST APIs with comprehensive security checks. All changes create pull requests in your repositories for review before deployment.

= Can I install plugins directly from GitHub? =

Yes, plugins installed directly via GitHub will be tracked on the governing site, even if not added through OneUpdate.

= Are there limits on plugin management? =

There are no hard limits on the number of plugins you can manage from the governing site.

= Does this work with private plugins? =

Yes, you can upload private plugins which are securely stored in S3. For security, uploaded private plugins expire after 1 hour.

= Can I remove plugins from specific sites? =

Yes, you can remove plugins from specific sites directly through the governing interface.

= What CI/CD platforms are supported? =

OneUpdate works with any CI/CD platform that supports WordPress sites, including GitHub, GitLab, and Bitbucket.

= Is this compatible with WordPress multisite? =

Yes, OneUpdate supports both WordPress multisite networks and standalone WordPress installations.

= How does version management work? =

For public plugins, you can choose from the latest 5 available versions from WordPress.org. Private plugins use the uploaded version.

== Screenshots ==

1. OneUpdate Governing - Centralized plugin management interface
2. Plugin Browser - Search and filter plugins across all sites
3. Version Selection - Choose from latest 5 versions for updates
4. Site Configuration - Governing and Brand site setup
5. Bulk Operations - Update multiple plugins simultaneously
6. Private Plugin Upload - Secure private plugin management

== Changelog ==

= 1.0.0 =
* Initial release
* Centralized plugin management governing
* Support for public and private plugins
* GitHub Actions integration for automated PR creation
* S3 integration for private plugin storage
* Bulk plugin operations
* Version management (latest 5 versions)
* REST API with secure authentication
* WordPress multisite and standalone support

== Upgrade Notice ==

= 1.0.0 =
Initial release of OneUpdate. Perfect for enterprises managing multiple WordPress sites through CI/CD workflows.

== Requirements ==

* WordPress 6.8 or higher
* PHP 8.1 or higher
* Sites managed through CI/CD pipelines (GitHub/GitLab/Bitbucket)
* GitHub PAT token with repository write access
* S3 credentials for private plugin management

== Support ==

For support, feature requests, and bug reports, please visit our [GitHub repository](https://github.com/rtCamp/OneUpdate).

== Contributing ==

OneUpdate is open source and welcomes contributions. Visit our [GitHub repository](https://github.com/rtCamp/OneUpdate) to contribute code, report issues, or suggest features.

Development guidelines and contributing information can be found in our repository documentation.