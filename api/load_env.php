<?php
/**
 * InventoX - Environment Variables Loader
 * Carrega variáveis de ambiente automaticamente de múltiplas fontes
 */

function loadEnv($envPath = null) {
    // Primeiro, tentar detectar variáveis de ambiente do sistema (DigitalOcean, Railway, etc.)
    $envVars = [
        'DB_HOST' => null,
        'DB_NAME' => null, 
        'DB_USER' => null,
        'DB_PASS' => null,
        'DB_PORT' => null,
        'DEBUG_MODE' => null,
        'ENVIRONMENT' => null
    ];
    
    // Detectar variáveis do sistema primeiro
    foreach ($envVars as $key => $value) {
        if (isset($_ENV[$key])) {
            $envVars[$key] = $_ENV[$key];
        } elseif (isset($_SERVER[$key])) {
            $envVars[$key] = $_SERVER[$key];
        } elseif (getenv($key) !== false) {
            $envVars[$key] = getenv($key);
        }
    }
    
    // Se não encontrou DB_HOST, tentar detectar automaticamente baseado na plataforma
    if (!$envVars['DB_HOST']) {
        // DigitalOcean App Platform - DATABASE_URL
        if (isset($_ENV['DATABASE_URL']) || isset($_SERVER['DATABASE_URL'])) {
            $dbUrl = $_ENV['DATABASE_URL'] ?? $_SERVER['DATABASE_URL'] ?? getenv('DATABASE_URL');
            if ($dbUrl) {
                $parsed = parse_url($dbUrl);
                if ($parsed) {
                    $envVars['DB_HOST'] = $parsed['host'] ?? null;
                    $envVars['DB_NAME'] = ltrim($parsed['path'] ?? '', '/');
                    $envVars['DB_USER'] = $parsed['user'] ?? null;
                    $envVars['DB_PASS'] = $parsed['pass'] ?? null;
                    $envVars['DB_PORT'] = $parsed['port'] ?? 3306;
                }
            }
        }
        
        // Railway - MYSQL_URL
        if (!$envVars['DB_HOST'] && (isset($_ENV['MYSQL_URL']) || isset($_SERVER['MYSQL_URL']))) {
            $mysqlUrl = $_ENV['MYSQL_URL'] ?? $_SERVER['MYSQL_URL'] ?? getenv('MYSQL_URL');
            if ($mysqlUrl) {
                $parsed = parse_url($mysqlUrl);
                if ($parsed) {
                    $envVars['DB_HOST'] = $parsed['host'] ?? null;
                    $envVars['DB_NAME'] = ltrim($parsed['path'] ?? '', '/');
                    $envVars['DB_USER'] = $parsed['user'] ?? null;
                    $envVars['DB_PASS'] = $parsed['pass'] ?? null;
                    $envVars['DB_PORT'] = $parsed['port'] ?? 3306;
                }
            }
        }
        
        // Heroku JawsDB - JAWSDB_URL
        if (!$envVars['DB_HOST'] && (isset($_ENV['JAWSDB_URL']) || isset($_SERVER['JAWSDB_URL']))) {
            $jawsUrl = $_ENV['JAWSDB_URL'] ?? $_SERVER['JAWSDB_URL'] ?? getenv('JAWSDB_URL');
            if ($jawsUrl) {
                $parsed = parse_url($jawsUrl);
                if ($parsed) {
                    $envVars['DB_HOST'] = $parsed['host'] ?? null;
                    $envVars['DB_NAME'] = ltrim($parsed['path'] ?? '', '/');
                    $envVars['DB_USER'] = $parsed['user'] ?? null;
                    $envVars['DB_PASS'] = $parsed['pass'] ?? null;
                    $envVars['DB_PORT'] = $parsed['port'] ?? 3306;
                }
            }
        }
        
        // DigitalOcean Managed Database - variáveis individuais
        if (!$envVars['DB_HOST']) {
            $doVars = [
                'DB_HOST' => $_ENV['inventox-db.HOSTNAME'] ?? $_SERVER['inventox-db.HOSTNAME'] ?? getenv('inventox-db.HOSTNAME'),
                'DB_NAME' => $_ENV['inventox-db.DATABASE'] ?? $_SERVER['inventox-db.DATABASE'] ?? getenv('inventox-db.DATABASE'),
                'DB_USER' => $_ENV['inventox-db.USERNAME'] ?? $_SERVER['inventox-db.USERNAME'] ?? getenv('inventox-db.USERNAME'),
                'DB_PASS' => $_ENV['inventox-db.PASSWORD'] ?? $_SERVER['inventox-db.PASSWORD'] ?? getenv('inventox-db.PASSWORD'),
                'DB_PORT' => $_ENV['inventox-db.PORT'] ?? $_SERVER['inventox-db.PORT'] ?? getenv('inventox-db.PORT')
            ];
            
            foreach ($doVars as $key => $value) {
                if ($value) {
                    $envVars[$key] = $value;
                }
            }
        }
    }
    
    // Tentar carregar de ficheiro .env se ainda não temos as variáveis
    if (!$envVars['DB_HOST']) {
        if ($envPath === null) {
            // Tentar vários caminhos possíveis
            $possiblePaths = [
                __DIR__ . '/../.env',
                __DIR__ . '/.env',
                '/var/www/html/.env'
            ];
            
            foreach ($possiblePaths as $path) {
                if (file_exists($path)) {
                    $envPath = $path;
                    break;
                }
            }
        }
        
        if ($envPath && file_exists($envPath) && is_file($envPath)) {
            $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            
            if ($lines !== false) {
                foreach ($lines as $line) {
                    // Ignorar comentários
                    if (strpos(trim($line), '#') === 0) {
                        continue;
                    }
                    
                    // Processar linha KEY=VALUE
                    if (strpos($line, '=') !== false) {
                        list($key, $value) = explode('=', $line, 2);
                        $key = trim($key);
                        $value = trim($value);
                        
                        // Remover aspas se existirem
                        $value = trim($value, '"\'');
                        
                        if (array_key_exists($key, $envVars) && !$envVars[$key]) {
                            $envVars[$key] = $value;
                        }
                    }
                }
            }
        }
    }
    
    // Definir valores padrão se necessário
    $envVars['DB_PORT'] = $envVars['DB_PORT'] ?: '3306';
    $envVars['DEBUG_MODE'] = $envVars['DEBUG_MODE'] ?: 'false';
    $envVars['ENVIRONMENT'] = $envVars['ENVIRONMENT'] ?: 'production';
    
    // Aplicar as variáveis ao ambiente
    foreach ($envVars as $key => $value) {
        if ($value !== null) {
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
            putenv("$key=$value");
        }
    }
    
    return $envVars['DB_HOST'] !== null;
}

// Carregar automaticamente ao incluir este ficheiro
loadEnv();

?>