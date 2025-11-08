# Dockerfile otimizado para DigitalOcean
FROM php:8.1-apache

LABEL maintainer="Sandro Lopes <sandro.lopes@example.com>"
LABEL version="1.0"
LABEL description="InventoX PHP Application with Apache"

# Instalar extensões PHP necessárias e ferramentas de diagnóstico
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    curl \
    wget \
    procps \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configurar Apache modules
RUN a2enmod rewrite
RUN a2enmod headers

# Adicionar ServerName para evitar warnings do Apache
RUN echo 'ServerName localhost' >> /etc/apache2/apache2.conf

# Copiar arquivos da aplicação
COPY frontend/ /var/www/html/frontend/
COPY api/ /var/www/html/api/
COPY .htaccess /var/www/html/.htaccess

# Criar index.php para healthcheck e root
RUN echo '<?php' > /var/www/html/index.php && \
    echo 'header("Content-Type: text/html; charset=utf-8");' >> /var/www/html/index.php && \
    echo 'http_response_code(200);' >> /var/www/html/index.php && \
    echo 'echo "<!DOCTYPE html><html><head><title>InventoX</title></head><body>";' >> /var/www/html/index.php && \
    echo 'echo "<h1>✅ InventoX OK</h1>";' >> /var/www/html/index.php && \
    echo 'echo "<p><strong>Status:</strong> Funcionando</p>";' >> /var/www/html/index.php && \
    echo 'echo "<p><strong>PHP:</strong> " . PHP_VERSION . "</p>";' >> /var/www/html/index.php && \
    echo 'echo "<p><strong>Time:</strong> " . date("Y-m-d H:i:s") . "</p>";' >> /var/www/html/index.php && \
    echo 'echo "<hr>";' >> /var/www/html/index.php && \
    echo 'echo "<a href=\"/frontend/\">🚀 Aplicação</a> | ";' >> /var/www/html/index.php && \
    echo 'echo "<a href=\"/api/health.php\">🔧 API Health</a>";' >> /var/www/html/index.php && \
    echo 'echo "</body></html>";' >> /var/www/html/index.php && \
    echo '?>' >> /var/www/html/index.php

# Configurar permissões
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html
RUN chmod 644 /var/www/html/index.php

# Criar pasta de uploads
RUN mkdir -p /var/www/html/uploads && chown www-data:www-data /var/www/html/uploads

# Configurações PHP
RUN echo 'engine = On' >> /usr/local/etc/php/php.ini && \
    echo 'short_open_tag = Off' >> /usr/local/etc/php/php.ini && \
    echo 'default_mimetype = "text/html"' >> /usr/local/etc/php/php.ini && \
    echo 'default_charset = "UTF-8"' >> /usr/local/etc/php/php.ini && \
    echo 'max_execution_time = 30' >> /usr/local/etc/php/php.ini && \
    echo 'memory_limit = 128M' >> /usr/local/etc/php/php.ini

# Definir diretório de trabalho
WORKDIR /var/www/html

# Expor porta 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=10s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Comando para iniciar Apache
CMD ["apache2-foreground"]