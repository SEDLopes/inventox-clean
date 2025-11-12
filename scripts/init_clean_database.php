<?php
/**
 * Script de Inicialização Limpa - Para Novos Deploys
 * 
 * Este script inicializa uma base de dados completamente limpa
 * com estrutura completa e utilizador admin
 * 
 * Uso: Acessar via browser ou executar via CLI
 * URL: https://seu-app.ondigitalocean.app/scripts/init_clean_database.php?token=inventox-init-2024
 */

require_once __DIR__ . '/../api/db.php';

// Token de segurança
$validToken = 'inventox-init-2024';
$providedToken = $_GET['token'] ?? $_POST['token'] ?? '';

if ($providedToken !== $validToken) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Token inválido. Use: ?token=inventox-init-2024'
    ], JSON_PRETTY_PRINT);
    exit();
}

try {
    $db = getDB();
    
    // Verificar se já está inicializado
    $userCount = $db->query("SELECT COUNT(*) FROM users WHERE username = 'admin'")->fetchColumn();
    $itemCount = $db->query("SELECT COUNT(*) FROM items")->fetchColumn();
    
    if ($userCount > 0 && $itemCount == 0) {
        // Já está limpo
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => 'Base de dados já está limpa e inicializada',
            'status' => [
                'admin_exists' => true,
                'items_count' => 0,
                'ready' => true
            ]
        ], JSON_PRETTY_PRINT);
        exit();
    }
    
    $operations = [];
    $errors = [];
    
    // === 1. LIMPAR DADOS EXISTENTES (se houver) ===
    
    try {
        $db->exec("DELETE FROM inventory_counts");
        $operations[] = "✅ Contagens limpas";
    } catch (Exception $e) {
        // Tabela pode não existir ainda
    }
    
    try {
        $db->exec("DELETE FROM inventory_sessions");
        $operations[] = "✅ Sessões limpas";
    } catch (Exception $e) {}
    
    try {
        $db->exec("DELETE FROM stock_movements");
        $operations[] = "✅ Movimentos limpos";
    } catch (Exception $e) {}
    
    try {
        $db->exec("DELETE FROM items");
        $db->exec("ALTER TABLE items AUTO_INCREMENT = 1");
        $operations[] = "✅ Artigos limpos";
    } catch (Exception $e) {}
    
    try {
        $db->exec("DELETE FROM categories");
        $db->exec("ALTER TABLE categories AUTO_INCREMENT = 1");
        $operations[] = "✅ Categorias limpas";
    } catch (Exception $e) {}
    
    try {
        $stmt = $db->prepare("DELETE FROM users WHERE username != 'admin'");
        $stmt->execute();
        $operations[] = "✅ Utilizadores limpos (admin preservado)";
    } catch (Exception $e) {}
    
    // === 2. GARANTIR QUE ADMIN EXISTE ===
    
    $adminCheck = $db->query("SELECT * FROM users WHERE username = 'admin'")->fetch(PDO::FETCH_ASSOC);
    
    if (!$adminCheck) {
        // Criar admin se não existir
        $stmt = $db->prepare("
            INSERT INTO users (username, email, password_hash, role, is_active) 
            VALUES (:username, :email, :password_hash, :role, :is_active)
        ");
        $stmt->execute([
            'username' => 'admin',
            'email' => 'admin@inventox.local',
            'password_hash' => '$2y$10$mShlEzkOp7DNZupiaXsSn.MlQzaoOlqJauhrqlA.vakpY7Zpd7rLa', // admin123
            'role' => 'admin',
            'is_active' => 1
        ]);
        $operations[] = "✅ Utilizador admin criado";
    } else {
        $operations[] = "✅ Utilizador admin já existe";
    }
    
    // === 3. GARANTIR EMPRESA PADRÃO ===
    
    try {
        $companyCheck = $db->query("SELECT COUNT(*) FROM companies")->fetchColumn();
        if ($companyCheck == 0) {
            $db->exec("INSERT INTO companies (name, code, is_active) VALUES ('Empresa Padrão', 'EMP001', TRUE)");
            $operations[] = "✅ Empresa padrão criada";
        }
    } catch (Exception $e) {
        // Tabela pode não existir
    }
    
    // === 4. VERIFICAÇÃO FINAL ===
    
    $finalCheck = [
        'admin_exists' => $db->query("SELECT COUNT(*) FROM users WHERE username = 'admin'")->fetchColumn() > 0,
        'items_count' => (int)$db->query("SELECT COUNT(*) FROM items")->fetchColumn(),
        'categories_count' => (int)$db->query("SELECT COUNT(*) FROM categories")->fetchColumn(),
        'sessions_count' => (int)$db->query("SELECT COUNT(*) FROM inventory_sessions")->fetchColumn(),
        'counts_count' => (int)$db->query("SELECT COUNT(*) FROM inventory_counts")->fetchColumn()
    ];
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Base de dados inicializada com sucesso',
        'operations' => $operations,
        'errors' => $errors,
        'status' => $finalCheck,
        'timestamp' => date('Y-m-d H:i:s'),
        'credentials' => [
            'username' => 'admin',
            'email' => 'admin@inventox.local',
            'password' => 'admin123',
            'warning' => '⚠️ ALTERE A PASSWORD APÓS PRIMEIRO LOGIN!'
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    error_log("Init Clean Database Error: " . $e->getMessage());
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao inicializar base de dados',
        'error' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT);
}
?>
