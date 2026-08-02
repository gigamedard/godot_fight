FROM php:8.2-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    libzip-dev \
    libsqlite3-dev \
    libgmp-dev \
    zip \
    unzip \
    git \
    curl \
    && docker-php-ext-install pdo_mysql pdo_sqlite zip pcntl sockets gmp \
    && rm -rf /var/lib/apt/lists/*

# Node.js (binaire officiel) : nécessaire uniquement pour exécuter les scripts
# de règlement/consolidation du pot (settle_fight.js / consolidate_pool.js).
RUN curl -fsSL https://nodejs.org/dist/v20.19.2/node-v20.19.2-linux-x64.tar.xz \
        | tar -xJ -C /usr/local --strip-components=1 \
    && node --version

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . /var/www/html

RUN composer install --no-interaction --optimize-autoloader

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
