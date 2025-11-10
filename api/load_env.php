<?php
/**
 * InventoX - Environment Variables Loader
 * Carrega variáveis de ambiente automaticamente de múltiplas fontes
 */

/**
 * Resolve valores no formato ${inventox-db.HOSTNAME} utilizados pelo
 * DigitalOcean App Platform e tenta obter o valor real.
 */
function resolveDoTemplate($value) {
    if (!is_string($value) || strpos($value, '${') === false) {
        return $value;
    }

    if (preg_match('/\$\{([^}]+)\}/', $value, $matches)) {
        $template = $matches[1]; // ex: inventox-db.HOSTNAME

        // Tentar obter diretamente
        $directValue = $_ENV[$template] ?? $_SERVER[$template] ?? getenv($template);
        if ($directValue !== false && $directValue !== null && $directValue !== $value) {
            return $directValue;
        }

        $parts = explode('.', $template);
        if (count($parts) === 2) {
            $dbName = $parts[0];
            $varName = $parts[1];

            $alternatives = [
                $template,
                strtoupper(str_replace('-', '_', $dbName)) . '_' . $varName,
                $dbName . '_' . $varName,
                strtoupper($dbName . '_' . $varName),
                'DATABASE_' . $varName,
                $varName,
            ];

            foreach ($alternatives as $alt) {
                $altValue = $_ENV[$alt] ?? $_SERVER[$alt] ?? getenv($alt);
                if ($altValue !== false && $altValue !== null && $altValue !== $value) {
                    return $altValue;
                }
            }
        }
    }

    return $value;
}

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
        $rawValue = null;
        if (isset($_ENV[$key])) {
            $rawValue = $_ENV[$key];
        } elseif (isset($_SERVER[$key])) {
            $rawValue = $_SERVER[$key];
        } elseif (getenv($key) !== false) {
            $rawValue = getenv($key);
        }

        if ($rawValue !== null) {
            $envVars[$key] = resolveDoTemplate($rawValue);
        }
    }

    // Se não encontrou DB_HOST, tentar detectar automaticamente baseado na plataforma
    if (!$envVars['DB_HOST'] || strpos($envVars['DB_HOST'], '${') !== false) {
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
        if ((!$envVars['DB_HOST'] || strpos($envVars['DB_HOST'], '${') !== false) && (isset($_ENV['MYSQL_URL']) || isset($_SERVER['MYSQL_URL']))) {
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
        if ((!$envVars['DB_HOST'] || strpos($envVars['DB_HOST'], '${') !== false) && (isset($_ENV['JAWSDB_URL']) || isset($_SERVER['JAWSDB_URL']))) {
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
        if (!$envVars['DB_HOST'] || strpos($envVars['DB_HOST'], '${') !== false) {
            $doVars = [
                'DB_HOST' => $_ENV['inventox-db.HOSTNAME'] ?? $_SERVER['inventox-db.HOSTNAME'] ?? getenv('inventox-db.HOSTNAME'),
                'DB_NAME' => $_ENV['inventox-db.DATABASE'] ?? $_SERVER['inventox-db.DATABASE'] ?? getenv('inventox-db.DATABASE'),
                'DB_USER' => $_ENV['inventox-db.USERNAME'] ?? $_SERVER['inventox-db.USERNAME'] ?? getenv('inventox-db.USERNAME'),
                'DB_PASS' => $_ENV['inventox-db.PASSWORD'] ?? $_SERVER['inventox-db.PASSWORD'] ?? getenv('inventox-db.PASSWORD'),
                'DB_PORT' => $_ENV['inventox-db.PORT'] ?? $_SERVER['inventox-db.PORT'] ?? getenv('inventox-db.PORT')
            ];

            foreach ($doVars as $key => $value) {
                if ($value) {
                    $resolved = resolveDoTemplate($value);
                    if ($resolved && $resolved !== $value) {
                        $envVars[$key] = $resolved;
                    } elseif (!$envVars[$key] || strpos($envVars[$key], '${') !== false) {
                        $envVars[$key] = $resolved;
                    }
                }
            }
        }
    }

    // Tentar carregar de ficheiro .env se ainda não temos as variáveis
    if (!$envVars['DB_HOST'] || strpos($envVars['DB_HOST'], '${') !== false) {
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
                        $value = trim($value, "\"'");

                        if (array_key_exists($key, $envVars) && (!$envVars[$key] || strpos($envVars[$key], '${') !== false)) {
                            $envVars[$key] = resolveDoTemplate($value);
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

    return $envVars['DB_HOST'] !== null && strpos($envVars['DB_HOST'], '${') === false;
}

// Carregar automaticamente ao incluir este ficheiro
loadEnv();

?>
