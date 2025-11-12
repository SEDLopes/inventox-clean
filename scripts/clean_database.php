<?php
/**
 * Script para Limpar Base de Dados - Mantém Estrutura e Admin
 * 
 * Este script remove todos os dados mas preserva:
 * - Estrutura de todas as tabelas
 * - Utilizador admin
 * - Configurações básicas
 * 
 * ⚠️ ATENÇÃO: Este script apaga TODOS os dados exceto admin!
 * Use apenas em ambientes de desenvolvimento ou para preparar template limpo.
 */

require_once __DIR__ . '/../api/db.php';

// Verificar se está em modo de confirmação
$confirm = $_GET['confirm'] ?? $_POST['confirm'] ?? '';
$token = $_GET['token'] ?? $_POST['token'] ?? '';

// Token de segurança
$validToken = 'inventox-clean-db-2024';

if ($confirm !== 'yes' || $token !== $validToken) {
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Limpar Base de Dados - InventoX</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .warning { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .danger { background: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .info { background: #d1ecf1; border: 2px solid #0c5460; padding: 20px; border-radius: 8px; margin: 20px 0; }
            button { background: #dc3545; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
            button:hover { background: #c82333; }
            .form-group { margin: 15px 0; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="text"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        </style>
    </head>
    <body>
        <h1>⚠️ Limpar Base de Dados - InventoX</h1>
        
        <div class="danger">
            <h2>⚠️ AVISO CRÍTICO</h2>
            <p><strong>Esta operação irá apagar TODOS os dados da base de dados!</strong></p>
            <ul>
                <li>❌ Todos os artigos serão eliminados</li>
                <li>❌ Todas as contagens serão eliminadas</li>
                <li>❌ Todas as sessões serão eliminadas</li>
                <li>❌ Todos os movimentos de stock serão eliminados</li>
                <li>❌ Todos os utilizadores (exceto admin) serão eliminados</li>
                <li>❌ Todas as categorias serão eliminadas</li>
            </ul>
        </div>
        
        <div class="info">
            <h3>✅ O que será preservado:</h3>
            <ul>
                <li>✅ Estrutura de todas as tabelas</li>
                <li>✅ Utilizador admin (username: admin)</li>
                <li>✅ Índices e constraints</li>
                <li>✅ Foreign keys</li>
            </ul>
        </div>
        
        <div class="warning">
            <h3>📋 Use este script para:</h3>
            <ul>
                <li>Preparar template limpo para novo deploy</li>
                <li>Resetar ambiente de desenvolvimento</li>
                <li>Criar cópia limpa do sistema</li>
            </ul>
        </div>
        
        <form method="POST" onsubmit="return confirm('Tem CERTEZA que quer apagar TODOS os dados? Esta ação NÃO pode ser desfeita!');">
            <div class="form-group">
                <label for="token">Token de Segurança:</label>
                <input type="text" id="token" name="token" placeholder="Digite o token de segurança" required>
                <small>Token: <code>inventox-clean-db-2024</code></small>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" name="confirm" value="yes" required>
                    Confirmo que quero apagar TODOS os dados e compreendo que esta ação é IRREVERSÍVEL
                </label>
            </div>
            
            <button type="submit">🗑️ LIMPAR BASE DE DADOS</button>
        </form>
    </body>
    </html>
    <?php
    exit();
}

// Verificar autenticação (opcional, mas recomendado)
// requireAuth();

try {
    $db = getDB();
    $db->beginTransaction();
    
    $operations = [];
    $errors = [];
    
    // === 1. BACKUP DO ADMIN USER ===
    $adminBackup = $db->query("SELECT * FROM users WHERE username = 'admin'")->fetch(PDO::FETCH_ASSOC);
    if (!$adminBackup) {
        throw new Exception("Utilizador admin não encontrado!");
    }
    $operations[] = "✅ Admin user encontrado e preservado";
    
    // === 2. LIMPAR DADOS (ordem importante devido a foreign keys) ===
    
    // 2.1. Limpar contagens de inventário
    try {
        $count = $db->exec("DELETE FROM inventory_counts");
        $operations[] = "✅ Eliminadas {$count} contagens de inventário";
    } catch (Exception $e) {
        $errors[] = "Erro ao limpar inventory_counts: " . $e->getMessage();
    }
    
    // 2.2. Limpar sessões de inventário
    try {
        $count = $db->exec("DELETE FROM inventory_sessions");
        $operations[] = "✅ Eliminadas {$count} sessões de inventário";
    } catch (Exception $e) {
        $errors[] = "Erro ao limpar inventory_sessions: " . $e->getMessage();
    }
    
    // 2.3. Limpar movimentos de stock
    try {
        $count = $db->exec("DELETE FROM stock_movements");
        $operations[] = "✅ Eliminados {$count} movimentos de stock";
    } catch (Exception $e) {
        $errors[] = "Erro ao limpar stock_movements: " . $e->getMessage();
    }
    
    // 2.4. Limpar artigos
    try {
        $count = $db->exec("DELETE FROM items");
        $operations[] = "✅ Eliminados {$count} artigos";
        // Reset auto_increment
        $db->exec("ALTER TABLE items AUTO_INCREMENT = 1");
        $operations[] = "✅ Reset auto_increment de items";
    } catch (Exception $e) {
        $errors[] = "Erro ao limpar items: " . $e->getMessage();
    }
    
    // 2.5. Limpar categorias (exceto se houver foreign keys)
    try {
        $count = $db->exec("DELETE FROM categories");
        $operations[] = "✅ Eliminadas {$count} categorias";
        // Reset auto_increment
        $db->exec("ALTER TABLE categories AUTO_INCREMENT = 1");
        $operations[] = "✅ Reset auto_increment de categories";
    } catch (Exception $e) {
        $errors[] = "Erro ao limpar categories: " . $e->getMessage();
    }
    
    // 2.6. Limpar utilizadores (exceto admin)
    try {
        $stmt = $db->prepare("DELETE FROM users WHERE username != 'admin'");
        $stmt->execute();
        $count = $stmt->rowCount();
        $operations[] = "✅ Eliminados {$count} utilizadores (admin preservado)";
    } catch (Exception $e) {
        $errors[] = "Erro ao limpar users: " . $e->getMessage();
    }
    
    // 2.7. Limpar empresas (opcional - manter estrutura)
    try {
        $count = $db->exec("DELETE FROM companies");
        $operations[] = "✅ Eliminadas {$count} empresas";
        $db->exec("ALTER TABLE companies AUTO_INCREMENT = 1");
    } catch (Exception $e) {
        // Ignorar se tabela não existir
    }
    
    // 2.8. Limpar armazéns (opcional - manter estrutura)
    try {
        $count = $db->exec("DELETE FROM warehouses");
        $operations[] = "✅ Eliminados {$count} armazéns";
        $db->exec("ALTER TABLE warehouses AUTO_INCREMENT = 1");
    } catch (Exception $e) {
        // Ignorar se tabela não existir
    }
    
    // === 3. VERIFICAR SE ADMIN AINDA EXISTE ===
    $adminCheck = $db->query("SELECT * FROM users WHERE username = 'admin'")->fetch(PDO::FETCH_ASSOC);
    if (!$adminCheck) {
        // Restaurar admin se foi eliminado por engano
        $stmt = $db->prepare("
            INSERT INTO users (username, email, password_hash, role) 
            VALUES (:username, :email, :password_hash, :role)
        ");
        $stmt->execute([
            'username' => $adminBackup['username'],
            'email' => $adminBackup['email'],
            'password_hash' => $adminBackup['password_hash'],
            'role' => $adminBackup['role']
        ]);
        $operations[] = "✅ Admin user restaurado";
    } else {
        $operations[] = "✅ Admin user preservado corretamente";
    }
    
    // === 4. INSERIR DADOS INICIAIS (OPCIONAL) ===
    
    // Inserir empresa padrão se não existir
    try {
        $companyCheck = $db->query("SELECT COUNT(*) FROM companies")->fetchColumn();
        if ($companyCheck == 0) {
            $db->exec("INSERT INTO companies (name, code, is_active) VALUES ('Empresa Padrão', 'EMP001', TRUE)");
            $operations[] = "✅ Empresa padrão criada";
        }
    } catch (Exception $e) {
        // Ignorar se tabela não existir
    }
    
    // === 5. COMMIT ===
    $db->commit();
    
    // === 6. RESUMO ===
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Base de Dados Limpa - InventoX</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .success { background: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .error { background: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .info { background: #d1ecf1; border: 2px solid #0c5460; padding: 20px; border-radius: 8px; margin: 20px 0; }
            ul { list-style: none; padding: 0; }
            li { padding: 5px 0; }
            .timestamp { color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <h1>✅ Base de Dados Limpa com Sucesso!</h1>
        
        <div class="success">
            <h2>Operações Realizadas:</h2>
            <ul>
                <?php foreach ($operations as $op): ?>
                    <li><?php echo htmlspecialchars($op); ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
        
        <?php if (!empty($errors)): ?>
        <div class="error">
            <h2>⚠️ Avisos:</h2>
            <ul>
                <?php foreach ($errors as $error): ?>
                    <li><?php echo htmlspecialchars($error); ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
        <?php endif; ?>
        
        <div class="info">
            <h3>📊 Estado Atual:</h3>
            <ul>
                <li>✅ Estrutura de tabelas preservada</li>
                <li>✅ Utilizador admin preservado</li>
                <li>✅ Base de dados pronta para novo deploy</li>
                <li>✅ Todos os dados de produção eliminados</li>
            </ul>
        </div>
        
        <p class="timestamp">Operação realizada em: <?php echo date('Y-m-d H:i:s'); ?></p>
        
        <p><a href="/frontend/">← Voltar ao Sistema</a></p>
    </body>
    </html>
    <?php
    
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollback();
    }
    
    error_log("Clean Database Error: " . $e->getMessage());
    
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Erro ao Limpar Base de Dados</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .error { background: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 8px; }
        </style>
    </head>
    <body>
        <h1>❌ Erro ao Limpar Base de Dados</h1>
        <div class="error">
            <p><strong>Erro:</strong> <?php echo htmlspecialchars($e->getMessage()); ?></p>
            <p>Nenhuma alteração foi feita. A base de dados permanece intacta.</p>
        </div>
        <p><a href="javascript:history.back()">← Voltar</a></p>
    </body>
    </html>
    <?php
}
?>
