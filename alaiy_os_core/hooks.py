app_name = "alaiy_os_core"
app_title = "Alaiy OS Core"
app_publisher = "Alaiy"
app_description = "AlaiyOS backend — connectors, APIs, DocTypes"
app_email = "dev@alaiy.com"
app_license = "MIT"

# Called once on install and on every migrate.
# All setup helpers are idempotent so running on migrate is safe —
# ensures master data and custom fields are present on fresh sites too.
after_install = "alaiy_os_core.setup.install.after_install"
after_migrate = "alaiy_os_core.setup.install.after_migrate"

scheduler_events = {
    "cron": {
        # Incremental stock/price event sync every 15 minutes
        "*/15 * * * *": [
            "alaiy_os_core.connectors.cloudstore.sync_job.sync_incremental",
            "alaiy_os_core.connectors.shopify.sync_job.pull_inventory",
        ],
    },
    "daily": [
        # Full catalog + category refresh once a day (off-peak)
        "alaiy_os_core.connectors.cloudstore.sync_job.sync_categories",
        "alaiy_os_core.connectors.cloudstore.sync_job.sync_full_catalog",
        "alaiy_os_core.connectors.shopify.sync_job.pull_full_catalog",
    ],
}
