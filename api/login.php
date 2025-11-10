<?php
/**
 * InventoX - Login API
 * Endpoint de autenticação de utilizadores
 */

require_once __DIR__ . '/db.php';

// Permitir apenas POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método não permitido'
    ], 405);
}

// Obter dados do POST
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    $input = $_POST;
}

$username = sanitizeInput($input['username'] ?? '');
$password = $input['password'] ?? '';

// Validação
if (empty($username) || empty($password)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Username e password são obrigatórios'
    ], 400);
}

try {
    $db = getDB();
    
    // Log de debug
    error_log("Login attempt - Username: " . $username);
    
    // Buscar utilizador (usar named parameter corretamente para OR)
    $stmt = $db->prepare("
        SELECT id, username, email, password_hash, role, is_active 
        FROM users 
        WHERE username = :username OR email = :email
    ");
    $stmt->execute(['username' => $username, 'email' => $username]);
    $user = $stmt->fetch();

    // Log de debug
    if (!$user) {
        error_log("Login failed - User not found: " . $username);
        sendJsonResponse([
            'success' => false,
            'message' => 'Credenciais inválidas',
            'debug' => 'Utilizador não encontrado'
        ], 401);
    }
    
    error_log("Login - User found: " . $user['username'] . ", Active: " . ($user['is_active'] ? 'YES' : 'NO'));

    // Verificar se utilizador está ativo
    if (!$user['is_active']) {
        error_log("Login failed - User inactive: " . $username);
        sendJsonResponse([
            'success' => false,
            'message' => 'Utilizador inativo'
        ], 403);
    }

    // Verificar password
    $passwordValid = password_verify($password, $user['password_hash']);
    error_log("Login - Password verification: " . ($passwordValid ? 'OK' : 'FAILED') . 
              ", Hash length: " . strlen($user['password_hash']));
    
    if (!$passwordValid) {
        error_log("Login failed - Invalid password for user: " . $username);
        sendJsonResponse([
            'success' => false,
            'message' => 'Credenciais inválidas',
            'debug' => 'Password não corresponde'
        ], 401);
    }

    // Se já existir uma sessão ativa, destruí-la primeiro para evitar conflitos
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    
    // Configurar cookies de sessão ANTES de session_start()
    // IMPORTANTE: ini_set deve ser chamado ANTES de session_start()
    
    // Detectar HTTPS automaticamente
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
               (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
               (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on');
    
    // Configurar cookies básicos
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_path', '/');
    ini_set('session.cookie_domain', '');
    ini_set('session.cookie_lifetime', 0); // Cookie de sessão (expira ao fechar navegador)
    ini_set('session.cookie_secure', $isHttps ? '1' : '0');
    
    // SameSite só está disponível no PHP 7.3+
    if (PHP_VERSION_ID >= 70300) {
        try {
            if ($isHttps) {
                ini_set('session.cookie_samesite', 'None');
            } else {
                ini_set('session.cookie_samesite', 'Lax');
            }
        } catch (Exception $e) {
            error_log("Login - Failed to set SameSite: " . $e->getMessage());
        }
    }
    
    // Configurar diretório de sessões (se não estiver configurado)
    $sessionPath = ini_get('session.save_path');
    if (empty($sessionPath) || !is_dir($sessionPath) || !is_writable($sessionPath)) {
        // Tentar vários diretórios possíveis (melhorado do dia 4, mas mantendo simplicidade)
        $possiblePaths = [
            '/var/lib/php/sessions',  // Produção (Docker)
            sys_get_temp_dir() . '/php_sessions',  // Desenvolvimento local
            __DIR__ . '/../sessions',  // Relativo ao projeto
            '/tmp/php_sessions'  // Fallback
        ];
        
        foreach ($possiblePaths as $path) {
            if (is_dir($path) && is_writable($path)) {
                ini_set('session.save_path', $path);
                break;
            } elseif (@mkdir($path, 0755, true)) {
                ini_set('session.save_path', $path);
                break;
            }
        }
    }
    
    // Iniciar sessão
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    // Regenerar ID de sessão ANTES de armazenar dados (para segurança)
    // Isso evita session fixation attacks
    session_regenerate_id(true);
    
    // Armazenar dados na sessão
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role'] = $user['role'];
    
    // Garantir que a sessão foi escrita (PHP faz isso automaticamente ao finalizar script)
    // Mas vamos verificar que os dados estão realmente na sessão
    
    // Log de login para debug
    $cookieName = session_name();
    $sessionId = session_id();
    error_log("Login successful - Session ID: " . $sessionId . 
              ", Cookie name: " . $cookieName . 
              ", User: {$user['username']}, " .
              "Session has user_id: " . (isset($_SESSION['user_id']) ? 'YES' : 'NO'));
    
    // Verificar se os dados estão na sessão
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['username'])) {
        error_log("ERRO CRÍTICO: Dados da sessão não foram salvos após login!");
        sendJsonResponse([
            'success' => false,
            'message' => 'Erro ao criar sessão'
        ], 500);
    }

    sendJsonResponse([
        'success' => true,
        'message' => 'Login realizado com sucesso',
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);

} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    error_log("Login error trace: " . $e->getTraceAsString());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao processar login: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Login general error: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao processar login: ' . $e->getMessage()
    ], 500);
}
