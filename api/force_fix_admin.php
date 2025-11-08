<?php
/**
 * Script para FORÇAR correção do admin e testar login
 * Acesse: https://seu-app.ondigitalocean.app/api/force_fix_admin.php?token=inventox2
 */

// Token de segurança - aceitar tokens truncados
$valid_tokens = ['inventox2024', 'inventox2', 'inventox'];
$provided_token = $_GET['token'] ?? $_POST['token'] ?? '';

$token_valid = false;
foreach ($valid_tokens as $valid_token) {
    if (trim($provided_token) === $valid_token || strpos($valid_token, trim($provided_token)) === 0) {
        $token_valid = true;
        break;
    }
}

if (!$token_valid) {
    http_response_code(403);
    die(json_encode(['error' => 'Token inválido. Use: ?token=inventox2']));
}

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/db.php';
    
    $db = getDB();
    
    // 1. Verificar se admin existe
    $stmt = $db->prepare("SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = 'admin'");
    $stmt->execute();
    $adminUser = $stmt->fetch();
    
    $result = [
        'before' => [
            'exists' => false,
            'is_active' => false,
            'password_hash_length' => 0,
            'password_test' => false
        ],
        'action' => '',
        'after' => [
            'exists' => false,
            'is_active' => false,
            'password_hash_length' => 0,
            'password_test' => false
        ],
        'login_test' => [
            'success' => false,
            'error' => null
        ]
    ];
    
    if ($adminUser) {
        $result['before'] = [
            'exists' => true,
            'is_active' => (bool)$adminUser['is_active'],
            'password_hash_length' => strlen($adminUser['password_hash']),
            'password_test' => password_verify('admin123', $adminUser['password_hash'])
        ];
    }
    
    // 2. Gerar novo hash para admin123
    $newPasswordHash = password_hash('admin123', PASSWORD_DEFAULT);
    
    // 3. Forçar criação/atualização do admin
    $stmt = $db->prepare("
        INSERT INTO users (username, email, password_hash, role, is_active) 
        VALUES ('admin', 'admin@inventox.com', :password_hash, 'admin', 1)
        ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        is_active = 1,
        role = 'admin'
    ");
    $stmt->execute(['password_hash' => $newPasswordHash]);
    
    $result['action'] = $adminUser ? 'updated' : 'created';
    
    // 4. Verificar após correção
    $stmt = $db->prepare("SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = 'admin'");
    $stmt->execute();
    $updatedUser = $stmt->fetch();
    
    if ($updatedUser) {
        $result['after'] = [
            'exists' => true,
            'is_active' => (bool)$updatedUser['is_active'],
            'password_hash_length' => strlen($updatedUser['password_hash']),
            'password_test' => password_verify('admin123', $updatedUser['password_hash'])
        ];
        
        // 5. Testar login direto
        $stmt = $db->prepare("
            SELECT id, username, email, password_hash, role, is_active 
            FROM users 
            WHERE username = :username
        ");
        $stmt->execute(['username' => 'admin']);
        $user = $stmt->fetch();
        
        if ($user && $user['is_active'] && password_verify('admin123', $user['password_hash'])) {
            $result['login_test'] = [
                'success' => true,
                'user_id' => $user['id'],
                'username' => $user['username'],
                'role' => $user['role']
            ];
        } else {
            $result['login_test'] = [
                'success' => false,
                'error' => 'Login test failed - user not found, inactive, or password mismatch'
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Admin corrigido e testado com sucesso!',
        'result' => $result,
        'credentials' => [
            'username' => 'admin',
            'password' => 'admin123'
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>

