<?php
/**
 * InventoX - Stock History API
 * Histórico de movimentações de stock
 */

require_once __DIR__ . '/db.php';

// Headers CORS (ANTES da autenticação)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verificar autenticação
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

// Apenas GET permitido
if ($method !== 'GET') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método não permitido'
    ], 405);
}

try {
    $db = getDB();
    
    // Verificar se a tabela stock_movements existe
    $checkTable = $db->query("SHOW TABLES LIKE 'stock_movements'");
    if ($checkTable->rowCount() == 0) {
        // Tabela não existe, retornar vazio
        sendJsonResponse([
            'success' => true,
            'movements' => [],
            'pagination' => [
                'page' => 1,
                'limit' => 20,
                'total' => 0,
                'pages' => 0
            ]
        ]);
    }
    
    // Parâmetros de filtro
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;
    $offset = ($page - 1) * $limit;
    
    $itemId = isset($_GET['item_id']) ? intval($_GET['item_id']) : null;
    $movementType = isset($_GET['type']) ? sanitizeInput($_GET['type']) : null;
    $dateFrom = isset($_GET['date_from']) ? sanitizeInput($_GET['date_from']) : null;
    $dateTo = isset($_GET['date_to']) ? sanitizeInput($_GET['date_to']) : null;
    
    // Verificar se a tabela inventory_counts existe
    $checkInventoryTable = $db->query("SHOW TABLES LIKE 'inventory_counts'");
    $hasInventoryCounts = $checkInventoryTable->rowCount() > 0;
    
    // Construir query unificada (UNION) para incluir tanto movimentos quanto contagens
    if ($hasInventoryCounts) {
        $query = "
            (SELECT 
                CONCAT('movement_', sm.id) as id,
                sm.item_id,
                i.barcode,
                i.name as item_name,
                sm.movement_type as type,
                sm.quantity,
                sm.reason as description,
                sm.user_id,
                u.username as user_name,
                sm.created_at,
                'movement' as source_type
            FROM stock_movements sm
            INNER JOIN items i ON sm.item_id = i.id
            LEFT JOIN users u ON sm.user_id = u.id
            WHERE 1=1)
            
            UNION ALL
            
            (SELECT 
                CONCAT('count_', ic.id) as id,
                ic.item_id,
                i.barcode,
                i.name as item_name,
                CASE 
                    WHEN ic.difference > 0 THEN 'entrada'
                    WHEN ic.difference < 0 THEN 'saida'
                    ELSE 'contagem'
                END as type,
                ic.difference as quantity,
                CONCAT('Contagem de inventário - Contado: ', ic.counted_quantity, ', Esperado: ', ic.expected_quantity) as description,
                ic.user_id,
                u.username as user_name,
                ic.counted_at as created_at,
                'inventory_count' as source_type
            FROM inventory_counts ic
            INNER JOIN items i ON ic.item_id = i.id
            LEFT JOIN users u ON ic.user_id = u.id
            WHERE 1=1)
        ";
    } else {
        // Fallback para apenas movimentos se inventory_counts não existir
        $query = "
            SELECT 
                sm.id,
                sm.item_id,
                i.barcode,
                i.name as item_name,
                sm.movement_type as type,
                sm.quantity,
                sm.reason as description,
                sm.user_id,
                u.username as user_name,
                sm.created_at,
                'movement' as source_type
            FROM stock_movements sm
            INNER JOIN items i ON sm.item_id = i.id
            LEFT JOIN users u ON sm.user_id = u.id
            WHERE 1=1
        ";
    }
    
    // Aplicar filtros na query UNION
    $whereConditions = [];
    $params = [];
    
    if ($itemId) {
        $whereConditions[] = "item_id = :item_id";
        $params['item_id'] = $itemId;
    }
    
    if ($movementType && in_array($movementType, ['entrada', 'saida', 'ajuste', 'transferencia', 'contagem'])) {
        $whereConditions[] = "type = :movement_type";
        $params['movement_type'] = $movementType;
    }
    
    if ($dateFrom) {
        $whereConditions[] = "DATE(created_at) >= :date_from";
        $params['date_from'] = $dateFrom;
    }
    
    if ($dateTo) {
        $whereConditions[] = "DATE(created_at) <= :date_to";
        $params['date_to'] = $dateTo;
    }
    
    // Se há filtros, aplicar na query UNION usando subquery
    if (!empty($whereConditions)) {
        $whereClause = " WHERE " . implode(" AND ", $whereConditions);
        $query = "SELECT * FROM ($query) as unified_history $whereClause";
    }
    
    $query .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
    
    $stmt = $db->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue(":{$key}", $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $movements = $stmt->fetchAll();
    
    // Contar total
    $countQuery = "
        SELECT COUNT(*) as total
        FROM stock_movements sm
        WHERE 1=1
    ";
    
    $countParams = [];
    
    if ($itemId) {
        $countQuery .= " AND sm.item_id = :item_id";
        $countParams['item_id'] = $itemId;
    }
    
    if ($movementType) {
        $countQuery .= " AND sm.movement_type = :movement_type";
        $countParams['movement_type'] = $movementType;
    }
    
    if ($dateFrom) {
        $countQuery .= " AND DATE(sm.created_at) >= :date_from";
        $countParams['date_from'] = $dateFrom;
    }
    
    if ($dateTo) {
        $countQuery .= " AND DATE(sm.created_at) <= :date_to";
        $countParams['date_to'] = $dateTo;
    }
    
    $countStmt = $db->prepare($countQuery);
    foreach ($countParams as $key => $value) {
        $countStmt->bindValue(":{$key}", $value);
    }
    $countStmt->execute();
    $total = $countStmt->fetch()['total'];
    
    // Formatar dados
    foreach ($movements as &$movement) {
        // Traduzir tipo de movimento
        $typeLabels = [
            'entrada' => 'Entrada',
            'saida' => 'Saída',
            'ajuste' => 'Ajuste',
            'transferencia' => 'Transferência'
        ];
        $movement['movement_type_label'] = $typeLabels[$movement['movement_type']] ?? $movement['movement_type'];
        
        // Formatar data
        $movement['formatted_date'] = date('d/m/Y H:i', strtotime($movement['created_at']));
    }
    
    sendJsonResponse([
        'success' => true,
        'movements' => $movements,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => ceil($total / $limit)
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro ao obter histórico de movimentações: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao obter histórico de movimentações'
    ], 500);
}

