# InventoX - Dockerfile Otimizado para Produção
FROM php:8.1-apache

LABEL maintainer="Sandro Lopes"
LABEL version="2.0"
LABEL description="InventoX - Sistema de Inventário Completo"

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    curl \
    wget \
    python3 \
    python3-pip \
    python3-venv \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configurar Apache
RUN a2enmod rewrite headers
RUN echo 'ServerName localhost' >> /etc/apache2/apache2.conf

# Copiar aplicação
COPY frontend/ /var/www/html/frontend/
COPY api/ /var/www/html/api/
COPY scripts/ /var/www/html/scripts/
COPY .htaccess /var/www/html/.htaccess

# Instalar dependências Python
COPY scripts/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Criar index.php para root
RUN echo '<?php' > /var/www/html/index.php && \
    echo 'header("Location: /frontend/");' >> /var/www/html/index.php && \
    echo 'exit();' >> /var/www/html/index.php && \
    echo '?>' >> /var/www/html/index.php

# Configurar permissões
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Criar diretório de uploads
RUN mkdir -p /var/www/html/uploads && chown www-data:www-data /var/www/html/uploads

# Configurações PHP para produção
RUN echo 'memory_limit = 256M' >> /usr/local/etc/php/php.ini && \
    echo 'upload_max_filesize = 10M' >> /usr/local/etc/php/php.ini && \
    echo 'post_max_size = 12M' >> /usr/local/etc/php/php.ini && \
    echo 'max_execution_time = 60' >> /usr/local/etc/php/php.ini && \
    echo 'display_errors = Off' >> /usr/local/etc/php/php.ini && \
    echo 'log_errors = On' >> /usr/local/etc/php/php.ini && \
    echo 'error_log = /var/log/php_errors.log' >> /usr/local/etc/php/php.ini

WORKDIR /var/www/html
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

CMD ["apache2-foreground"]