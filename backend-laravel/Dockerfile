FROM php:8.5-fpm-bookworm AS base
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev libonig-dev libicu-dev libzip-dev libxml2-dev unzip util-linux \
 && docker-php-ext-install -j"$(nproc)" pdo_pgsql mbstring intl zip bcmath pcntl dom xml xmlreader xmlwriter \
 && rm -rf /var/lib/apt/lists/*
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php.ini /usr/local/etc/php/conf.d/seka.ini
WORKDIR /var/www/html

FROM base AS build
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress
COPY . .
RUN composer dump-autoload --no-dev --optimize --no-interaction && composer check-platform-reqs --no-dev

FROM base
COPY --from=build --chown=www-data:www-data /var/www/html /var/www/html
COPY docker/entrypoint.sh /usr/local/bin/seka-entrypoint
RUN chmod +x /usr/local/bin/seka-entrypoint
ENTRYPOINT ["seka-entrypoint"]
CMD ["php-fpm","-F"]
