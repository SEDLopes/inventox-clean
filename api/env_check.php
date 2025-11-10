<?php
/**
 * InventoX - Environment Variables Check
 * Endpoint para verificar configuração de variáveis de ambiente
 */

header('Content-Type: application/json; charset=utf-8');

// Carregar variáveis de ambiente
require_once __DIR__ . '/load_env.php';

// Função para obter valor de variável de múltiplas fontes
function getEnvValue($key) {
    $sources = [];
    
    // $_ENV
    if (isset($_ENV[$key])) {
        $sources['$_ENV'] = $_ENV[$key];
    }
    
    // $_SERVER
    if (isset($_SERVER[$key])) {
        $sources['$_SERVER'] = $_SERVER[$key];
    }
    
    // getenv()
    $getenvValue = getenv($key);
    if ($getenvValue !== false) {
        $sources['getenv()'] = $getenvValue;
    }
    
    // Variáveis específicas do DigitalOcean
    $doKey = "inventox-db." . str_replace('DB_', '', $key);
    if (isset($_ENV[$doKey])) {
        $sources['DO_' . $doKey] = $_ENV[$doKey];
    }
    if (isset($_SERVER[$doKey])) {
        $sources['DO_SERVER_' . $doKey] = $_SERVER[$doKey];
    }
    
    return [
        'value' => $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key) ?: null,
        'sources' => $sources
    ];
}

// Verificar todas as variáveis necessárias
$envVars = [
    'DB_HOST',
    'DB_NAME', 
    'DB_USER',
    'DB_PASS',
    'DB_PORT',
    'DEBUG_MODE',
    'ENVIRONMENT'
];

$result = [
    'success' => true,
    'message' => 'Verificação de variáveis de ambiente',
    'variables' => [],
    'platform_detection' => [],
    'all_env' => [],
    'all_server' => []
];

// Verificar cada variável
foreach ($envVars as $var) {
    $envData = getEnvValue($var);
    $result['variables'][$var] = [
        'value' => $envData['value'] ? '[SET]' : 'NOT SET',
        'has_value' => !empty($envData['value']),
        'sources' => $envData['sources']
    ];
    
    if (!$envData['value'] && in_array($var, ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'])) {
        $result['success'] = false;
    }
}

// Detectar plataforma
if (isset($_ENV['DATABASE_URL']) || isset($_SERVER['DATABASE_URL'])) {
    $result['platform_detection']['DATABASE_URL'] = 'Found (DigitalOcean/Heroku style)';
}

if (isset($_ENV['MYSQL_URL']) || isset($_SERVER['MYSQL_URL'])) {
    $result['platform_detection']['MYSQL_URL'] = 'Found (Railway style)';
}

if (isset($_ENV['JAWSDB_URL']) || isset($_SERVER['JAWSDB_URL'])) {
    $result['platform_detection']['JAWSDB_URL'] = 'Found (Heroku JawsDB)';
}

// Verificar variáveis específicas do DigitalOcean
$doVars = ['HOSTNAME', 'DATABASE', 'USERNAME', 'PASSWORD', 'PORT'];
foreach ($doVars as $var) {
    $key = "inventox-db.$var";
    if (isset($_ENV[$key]) || isset($_SERVER[$key])) {
        $result['platform_detection'][$key] = 'Found (DigitalOcean Managed DB)';
    }
}

// Listar todas as variáveis de ambiente (apenas chaves para segurança)
$result['all_env'] = array_keys($_ENV);
$result['all_server'] = array_keys($_SERVER);

// Informações do sistema
$result['system_info'] = [
    'php_version' => PHP_VERSION,
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
    'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'Unknown'
];

echo json_encode($result, JSON_PRETTY_PRINT);
?>
