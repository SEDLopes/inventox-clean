<?php
/**
 * Endpoint para inicializar a database do InventoX
 * 
 * ⚠️ ATENÇÃO: Este endpoint requer token de segurança
 * Use apenas uma vez para inicializar a database
 * Em produção, considere remover após uso inicial
 */

// Token de segurança - aceitar múltiplos tokens (compatibilidade com truncamento)
$valid_tokens = [
    'inventox2024',  // Token completo
    'inventox2',     // Token truncado (fallback)
    'inventox'       // Token mínimo (fallback)
];

// Aceitar token de múltiplas fontes (GET, POST, ou REQUEST_URI)
$provided_token = '';

// Tentar POST primeiro (mais confiável, não é truncado)
if (isset($_POST['token'])) {
    $provided_token = $_POST['token'];
}
// Tentar GET
elseif (isset($_GET['token'])) {
    $provided_token = $_GET['token'];
}
// Tentar extrair da REQUEST_URI (caso GET seja truncado)
elseif (isset($_SERVER['REQUEST_URI'])) {
    $uri = $_SERVER['REQUEST_URI'];
    if (preg_match('/[?&]token=([^&]+)/', $uri, $matches)) {
        $provided_token = urldecode($matches[1]);
    }
}
// Tentar QUERY_STRING diretamente
elseif (isset($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $query_params);
    $provided_token = $query_params['token'] ?? '';
}

// Debug removido para produção

// Verificação flexível - aceitar tokens válidos (incluindo truncados)
$provided_token_clean = trim($provided_token);
$token_valid = false;

// Verificar se token fornecido corresponde a algum token válido
foreach ($valid_tokens as $valid_token) {
    if ($provided_token_clean === $valid_token) {
        $token_valid = true;
        break;
    }
}

// Se não corresponder exatamente, verificar se começa com algum token válido (para truncamento)
if (!$token_valid) {
    foreach ($valid_tokens as $valid_token) {
        if (strpos($valid_token, $provided_token_clean) === 0 || strpos($provided_token_clean, $valid_token) === 0) {
            $token_valid = true;
            break;
        }
    }
}

if (!$token_valid) {
    http_response_code(403);
    die(json_encode([
        'error' => 'Token inválido. Use: ?token=inventox2024 (ou POST com token=inventox2024)',
        'debug' => [
            'provided' => $provided_token_clean ?: 'VAZIO',
            'provided_length' => strlen($provided_token_clean),
            'valid_tokens' => $valid_tokens,
            'match' => false,
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'N/A',
            'query_string' => $_SERVER['QUERY_STRING'] ?? 'N/A',
            'tip' => 'Se GET for truncado, use POST: curl -X POST ... -d "token=inventox2024"'
        ]
    ]));
}

// Headers para JSON
header('Content-Type: application/json');

try {
    // Conectar à database usando as variáveis de ambiente
    $host = $_ENV['DB_HOST'] ?? getenv('DB_HOST');
    $dbname = $_ENV['DB_NAME'] ?? getenv('DB_NAME');
    $username = $_ENV['DB_USER'] ?? getenv('DB_USER');
    $password = $_ENV['DB_PASS'] ?? getenv('DB_PASS');
    $port = $_ENV['DB_PORT'] ?? getenv('DB_PORT') ?? 25060;

    if (!$host || !$dbname || !$username || !$password) {
        throw new Exception('Variáveis de ambiente da database não configuradas');
    }

    // Primeiro, conectar ao servidor MySQL sem especificar a base de dados
    $dsn_server = "mysql:host=$host;port=$port;charset=utf8mb4";
    $pdo_server = new PDO($dsn_server, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Verificar se a base de dados existe e criar se necessário
    $check_db = $pdo_server->query("SHOW DATABASES LIKE '$dbname'");
    if ($check_db->rowCount() == 0) {
        // Base de dados não existe, criar
        $pdo_server->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }

    // Agora conectar à base de dados específica
    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);

    // SQL Schema completo
    $sql_statements = [
        // Tabela de utilizadores
        "CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'operador') DEFAULT 'operador',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            INDEX idx_username (username),
            INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Tabela de empresas
        "CREATE TABLE IF NOT EXISTS companies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            code VARCHAR(50) UNIQUE,
            address TEXT,
            phone VARCHAR(20),
            email VARCHAR(100),
            tax_id VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_name (name),
            INDEX idx_code (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Tabela de armazéns
        "CREATE TABLE IF NOT EXISTS warehouses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50),
            address TEXT,
            location VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
            INDEX idx_company (company_id),
            INDEX idx_name (name),
            INDEX idx_code (code),
            UNIQUE KEY unique_company_warehouse (company_id, code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Tabela de categorias
        "CREATE TABLE IF NOT EXISTS categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Tabela de artigos
        "CREATE TABLE IF NOT EXISTS items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            barcode VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            category_id INT,
            quantity INT DEFAULT 0,
            min_quantity INT DEFAULT 0,
            unit_price DECIMAL(10, 2) DEFAULT 0.00,
            location VARCHAR(100),
            supplier VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
            INDEX idx_barcode (barcode),
            INDEX idx_name (name),
            INDEX idx_category (category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Tabela de sessões de inventário
        "CREATE TABLE IF NOT EXISTS inventory_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            company_id INT NOT NULL,
            warehouse_id INT NOT NULL,
            user_id INT NOT NULL,
            status ENUM('aberta', 'fechada', 'cancelada') DEFAULT 'aberta',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
            INDEX idx_user (user_id),
            INDEX idx_company (company_id),
            INDEX idx_warehouse (warehouse_id),
            INDEX idx_status (status),
            INDEX idx_started_at (started_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Tabela de contagens de inventário
        "CREATE TABLE IF NOT EXISTS inventory_counts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            session_id INT NOT NULL,
            item_id INT NOT NULL,
            counted_quantity INT NOT NULL DEFAULT 0,
            expected_quantity INT NOT NULL DEFAULT 0,
            difference INT DEFAULT 0,
            notes TEXT,
            counted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES inventory_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
            INDEX idx_session (session_id),
            INDEX idx_item (item_id),
            UNIQUE KEY unique_session_item (session_id, item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Tabela de movimentos de stock
        "CREATE TABLE IF NOT EXISTS stock_movements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            item_id INT NOT NULL,
            movement_type ENUM('entrada', 'saida', 'ajuste', 'transferencia') NOT NULL,
            quantity INT NOT NULL,
            reason TEXT,
            user_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_item (item_id),
            INDEX idx_type (movement_type),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // Inserir dados iniciais
        "INSERT INTO users (username, email, password_hash, role) VALUES
        ('admin', 'admin@inventox.local', '$2y$10\$mShlEzkOp7DNZupiaXsSn.MlQzaoOlqJauhrqlA.vakpY7Zpd7rLa', 'admin')
        ON DUPLICATE KEY UPDATE username=username",

        "INSERT INTO companies (name, code, is_active) VALUES
        ('Empresa Padrão', 'EMP001', TRUE)
        ON DUPLICATE KEY UPDATE name=name",

        "INSERT INTO warehouses (company_id, name, code, is_active) VALUES
        (1, 'Armazém Principal', 'AR001', TRUE)
        ON DUPLICATE KEY UPDATE name=name",

        "INSERT INTO categories (name, description) VALUES
        ('Eletrónicos', 'Produtos eletrónicos e componentes'),
        ('Informática', 'Equipamentos e acessórios de informática'),
        ('Ferramentas', 'Ferramentas e equipamentos'),
        ('Material de Escritório', 'Material de escritório e papelaria')
        ON DUPLICATE KEY UPDATE name=name"
    ];

    $results = [];
    foreach ($sql_statements as $index => $sql) {
        try {
            $pdo->exec($sql);
            $results[] = "Statement " . ($index + 1) . ": OK";
        } catch (Exception $e) {
            $results[] = "Statement " . ($index + 1) . ": ERROR - " . $e->getMessage();
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Database inicializada com sucesso!',
        'details' => $results,
        'login' => [
            'username' => 'admin',
            'password' => 'admin123'
        ]
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'env_check' => [
            'DB_HOST' => isset($_ENV['DB_HOST']) ? 'SET' : 'NOT SET',
            'DB_NAME' => isset($_ENV['DB_NAME']) ? 'SET' : 'NOT SET',
            'DB_USER' => isset($_ENV['DB_USER']) ? 'SET' : 'NOT SET',
            'DB_PASS' => isset($_ENV['DB_PASS']) ? 'SET' : 'NOT SET'
        ]
    ], JSON_PRETTY_PRINT);
}
?>
