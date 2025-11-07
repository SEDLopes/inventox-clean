<?php
// Configuração automática para hosting gratuito
// Substitua os valores abaixo pelas credenciais do seu hosting

// Base de dados
define('DB_HOST', 'localhost'); // ou o host fornecido pelo hosting
define('DB_NAME', 'inventox_db'); // nome da base de dados criada
define('DB_USER', 'inventox_user'); // utilizador da base de dados
define('DB_PASS', 'sua_password'); // password da base de dados

// URLs
define('API_BASE', 'https://seu-dominio.com/api');
define('FRONTEND_BASE', 'https://seu-dominio.com');

// Configurações de segurança
define('CSRF_SECRET', 'inventox_' . md5(__DIR__));

// Configurações de upload
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB

// Criar pasta de uploads se não existir
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}
?>
