<?php
/**
 * Script para corrigir password do utilizador admin
 * Acesse: https://seu-app.ondigitalocean.app/api/fix_admin_password.php?token=inventox2024
 */

// Token de segurança
$required_token = 'inventox2024';
$provided_token = $_GET['token'] ?? '';

if ($provided_token !== $required_token) {
    http_response_code(403);
    die(json_encode(['error' => 'Token inválido. Use: ?token=inventox2024']));
}

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/db.php';
    
    $db = getDB();
    
    // Gerar novo hash para admin123
    $newPasswordHash = password_hash('admin123', PASSWORD_DEFAULT);
    
    // Verificar se utilizador admin existe
    $stmt = $db->prepare("SELECT id, username, password_hash FROM users WHERE username = 'admin'");
    $stmt->execute();
    $adminUser = $stmt->fetch();
    
    if (!$adminUser) {
        // Criar utilizador admin se não existir
        $stmt = $db->prepare("
            INSERT INTO users (username, email, password_hash, role, is_active) 
            VALUES ('admin', 'admin@inventox.com', :password_hash, 'admin', 1)
        ");
        $stmt->execute(['password_hash' => $newPasswordHash]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Utilizador admin criado com sucesso!',
            'username' => 'admin',
            'password' => 'admin123',
            'action' => 'created'
        ], JSON_PRETTY_PRINT);
    } else {
        // Atualizar password do admin existente
        $stmt = $db->prepare("
            UPDATE users 
            SET password_hash = :password_hash, 
                is_active = 1,
                role = 'admin'
            WHERE username = 'admin'
        ");
        $stmt->execute(['password_hash' => $newPasswordHash]);
        
        // Verificar se atualizou
        $stmt = $db->prepare("SELECT id, username, password_hash, is_active, role FROM users WHERE username = 'admin'");
        $stmt->execute();
        $updatedUser = $stmt->fetch();
        
        // Testar password
        $passwordTest = password_verify('admin123', $updatedUser['password_hash']);
        
        echo json_encode([
            'success' => true,
            'message' => 'Password do utilizador admin atualizado com sucesso!',
            'username' => 'admin',
            'password' => 'admin123',
            'action' => 'updated',
            'user_id' => $updatedUser['id'],
            'is_active' => (bool)$updatedUser['is_active'],
            'role' => $updatedUser['role'],
            'password_test' => $passwordTest ? 'OK' : 'FALHA',
            'password_hash_length' => strlen($updatedUser['password_hash'])
        ], JSON_PRETTY_PRINT);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>
