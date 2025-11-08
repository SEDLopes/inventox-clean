# DigitalOcean Dockerfile - FORÇAR DETECÇÃO
FROM php:8.1-apache

# Metadados para forçar detecção
LABEL maintainer="InventoX"
LABEL description="InventoX PHP Application"

# Instalar extensões PHP necessárias
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configurar Apache
RUN a2enmod rewrite
RUN a2enmod headers

# CONFIGURAÇÃO APACHE NATIVA - FORÇAR PHP
RUN echo 'LoadModule php_module /usr/local/lib/php/extensions/no-debug-non-zts-20210902/php.so' >> /etc/apache2/apache2.conf || true
RUN echo 'AddType application/x-httpd-php .php' >> /etc/apache2/apache2.conf
RUN echo '<FilesMatch \.php$>' >> /etc/apache2/apache2.conf
RUN echo '    SetHandler application/x-httpd-php' >> /etc/apache2/apache2.conf
RUN echo '</FilesMatch>' >> /etc/apache2/apache2.conf

# Configurar DocumentRoot
RUN echo 'DocumentRoot /var/www/html' >> /etc/apache2/apache2.conf
RUN echo '<Directory /var/www/html>' >> /etc/apache2/apache2.conf
RUN echo '    Options Indexes FollowSymLinks' >> /etc/apache2/apache2.conf
RUN echo '    AllowOverride All' >> /etc/apache2/apache2.conf
RUN echo '    Require all granted' >> /etc/apache2/apache2.conf
RUN echo '    DirectoryIndex index.html index.php' >> /etc/apache2/apache2.conf
RUN echo '</Directory>' >> /etc/apache2/apache2.conf

# Copiar arquivos da aplicação
COPY frontend/ /var/www/html/
COPY api/ /var/www/html/api/
COPY .htaccess /var/www/html/.htaccess

# Verificar arquivos copiados
RUN ls -la /var/www/html/api/ | head -10

# Configurar permissões
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Criar pasta de uploads
RUN mkdir -p /var/www/html/uploads && chown www-data:www-data /var/www/html/uploads

# Configurar PHP
RUN echo 'engine = On' >> /usr/local/etc/php/php.ini
RUN echo 'short_open_tag = Off' >> /usr/local/etc/php/php.ini
RUN echo 'default_mimetype = "text/html"' >> /usr/local/etc/php/php.ini
RUN echo 'default_charset = "UTF-8"' >> /usr/local/etc/php/php.ini

# Workdir
WORKDIR /var/www/html

# Expor porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/api/health.php || exit 1

# Comando para iniciar Apache
CMD ["apache2-foreground"]