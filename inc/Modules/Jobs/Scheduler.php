<?php
/**
 * Job Scheduler functionality.
 *
 * @package OneUpdate\Modules\Jobs
 */

declare(strict_types = 1);

namespace OneUpdate\Modules\Jobs;

use OneUpdate\Contracts\Interfaces\Registrable;
use OneUpdate\Modules\Settings\Settings;

/**
 * Class Scheduler
 */
final class Scheduler implements Registrable {

	/**
	 * Global prefix.
	 *
	 * @todo need to replace with constant from main plugin file.
	 *
	 * @var string
	 */
	private const ONEUPDATE = 'oneupdate_';

	/**
	 * S3 Zip Cleanup Job Name.
	 *
	 * @var string
	 */
	public const S3_ZIP_CLEANUP = self::ONEUPDATE . 's3_zip_cleanup_event';

	/**
	 * {@inheritDoc}
	 */
	public function register_hooks(): void {
		if ( ! Settings::is_governing_site() ) {
			return;
		}

		self::register_jobs();
	}

	/**
	 * Register scheduled jobs.
	 *
	 * @return void
	 */
	public static function register_jobs(): void {
		// Schedule cron jobs - clear any existing schedules first.
		wp_clear_scheduled_hook( self::S3_ZIP_CLEANUP );

		// Schedule cron jobs.
		if ( wp_next_scheduled( self::S3_ZIP_CLEANUP ) ) {
			return;
		}

		wp_schedule_event( time(), 'hourly', self::S3_ZIP_CLEANUP );
	}
}
