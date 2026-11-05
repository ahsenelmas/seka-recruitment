#!/bin/sh
set -eu
if [ -z "${APP_KEY:-}" ]; then echo 'Set a persistent Laravel APP_KEY before starting.' >&2; exit 1; fi
mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
if [ "$1" = 'php' ]; then exec runuser -u www-data -- "$@"; fi
exec docker-php-entrypoint "$@"
