<?php
/**
 * InventoX - Test Database Connection
 * Endpoint para testar conexão à base de dados e diagnosticar problemas
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/load_env.php';

$result = [
    'success' => false,
    'message' => '',
    'diagnostics' => []
];

try {
    // Carregar variáveis de ambiente
    $host = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? null);
    $dbname = getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? null);
    $username = getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? null);
    $password = getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? null);
    $port = getenv('DB_PORT') ?: ($_ENV['DB_PORT'] ?? '3306');

    // Diagnóstico
    $result['diagnostics']['variables'] = [
        'DB_HOST' => $host ? (strlen($host) > 50 ? substr($host, 0, 50) . '...' : $host) : 'NOT SET',
        'DB_NAME' => $dbname ?: 'NOT SET',
        'DB_USER' => $username ?: 'NOT SET',
        'DB_PASS' => $password ? (strlen($password) > 10 ? substr($password, 0, 10) . '...' : 'SET') : 'NOT SET',
        'DB_PORT' => $port ?: 'NOT SET'
    ];

    // Verificar se todas as variáveis estão definidas
    if (!$host || !$dbname || !$username || !$password) {
        $result['message'] = 'Variáveis de ambiente não configuradas completamente';
        $result['diagnostics']['missing_vars'] = [];
        if (!$host) $result['diagnostics']['missing_vars'][] = 'DB_HOST';
        if (!$dbname) $result['diagnostics']['missing_vars'][] = 'DB_NAME';
        if (!$username) $result['diagnostics']['missing_vars'][] = 'DB_USER';
        if (!$password) $result['diagnostics']['missing_vars'][] = 'DB_PASS';
        echo json_encode($result, JSON_PRETTY_PRINT);
        exit;
    }

    // Verificar se o hostname contém templates não resolvidos
    if (strpos($host, '${') !== false) {
        $result['message'] = 'Hostname contém template não resolvido: ' . $host;
        $result['diagnostics']['template_issue'] = true;
        echo json_encode($result, JSON_PRETTY_PRINT);
        exit;
    }

    // Testar resolução DNS
    $result['diagnostics']['dns_test'] = [];
    $ip = @gethostbyname($host);
    if ($ip === $host) {
        // DNS não resolveu
        $result['message'] = 'Erro de DNS: Hostname não pode ser resolvido';
        $result['diagnostics']['dns_test']['resolved'] = false;
        $result['diagnostics']['dns_test']['ip'] = null;
        $result['diagnostics']['dns_test']['error'] = 'getaddrinfo failed: Name or service not known';
        
        // Tentar verificar se é um problema de rede
        $result['diagnostics']['suggestions'] = [
            'Verificar se a base de dados está ativa no DigitalOcean',
            'Verificar se a App está adicionada como Trusted Source na base de dados',
            'Verificar se o hostname está correto',
            'Verificar se a App e Database estão na mesma VPC (se aplicável)',
            'Verificar firewall/security groups da base de dados'
        ];
        
        echo json_encode($result, JSON_PRETTY_PRINT);
        exit;
    } else {
        $result['diagnostics']['dns_test']['resolved'] = true;
        $result['diagnostics']['dns_test']['ip'] = $ip;
    }

    // Tentar conexão
    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    
    $result['diagnostics']['connection_string'] = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5, // Timeout de 5 segundos
    ];

    try {
        $pdo = new PDO($dsn, $username, $password, $options);
        
        // Testar query simples
        $stmt = $pdo->query("SELECT 1 as test");
        $test = $stmt->fetch();
        
        if ($test && $test['test'] == 1) {
            $result['success'] = true;
            $result['message'] = 'Conexão à base de dados bem-sucedida!';
            $result['diagnostics']['connection'] = 'OK';
            $result['diagnostics']['query_test'] = 'OK';
        } else {
            $result['message'] = 'Conexão estabelecida mas query de teste falhou';
            $result['diagnostics']['connection'] = 'OK';
            $result['diagnostics']['query_test'] = 'FAILED';
        }
    } catch (PDOException $e) {
        $result['message'] = 'Erro de conexão: ' . $e->getMessage();
        $result['diagnostics']['connection'] = 'FAILED';
        $result['diagnostics']['error_code'] = $e->getCode();
        $result['diagnostics']['error_message'] = $e->getMessage();
        
        // Sugestões baseadas no erro
        if (strpos($e->getMessage(), 'getaddrinfo') !== false) {
            $result['diagnostics']['suggestions'] = [
                'Erro de DNS: Hostname não pode ser resolvido',
                'Verificar se a base de dados está ativa',
                'Verificar se a App está adicionada como Trusted Source',
                'Verificar se o hostname está correto',
                'Verificar configuração de rede/VPC'
            ];
        } elseif (strpos($e->getMessage(), 'Access denied') !== false) {
            $result['diagnostics']['suggestions'] = [
                'Erro de autenticação: Username ou Password incorretos',
                'Verificar credenciais na base de dados',
                'Verificar se o utilizador tem permissões adequadas'
            ];
        } elseif (strpos($e->getMessage(), 'Unknown database') !== false) {
            $result['diagnostics']['suggestions'] = [
                'Base de dados não existe',
                'Verificar se o nome da base de dados está correto',
                'Inicializar a base de dados primeiro'
            ];
        }
    }
} catch (Exception $e) {
    $result['message'] = 'Erro inesperado: ' . $e->getMessage();
    $result['diagnostics']['exception'] = $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT);
?>

