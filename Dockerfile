# Dockerfile otimizado para DigitalOcean App Platform
FROM php:8.1-apache

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

# Copiar todos os arquivos da aplicação
COPY . /var/www/html/

# Mover arquivos para estrutura correta
RUN mv /var/www/html/frontend/* /var/www/html/ 2>/dev/null || true
RUN mv /var/www/html/api /var/www/html/api 2>/dev/null || true

# Configurar permissões
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Criar pasta de uploads
RUN mkdir -p /var/www/html/uploads && chown www-data:www-data /var/www/html/uploads

# Configurar Apache para servir do diretório correto
WORKDIR /var/www/html

# Expor porta 80
EXPOSE 80

# Comando para iniciar Apache
CMD ["apache2-foreground"]