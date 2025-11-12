<?php
/**
 * InventoX - Stock History API (Fixed Version)
 * Histórico de movimentações de stock + contagens de inventário
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
    
    // Verificar se as tabelas existem
    $checkStockTable = $db->query("SHOW TABLES LIKE 'stock_movements'");
    $hasStockMovements = $checkStockTable->rowCount() > 0;
    
    $checkInventoryTable = $db->query("SHOW TABLES LIKE 'inventory_counts'");
    $hasInventoryCounts = $checkInventoryTable->rowCount() > 0;
    
    // Parâmetros de filtro
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;
    $offset = ($page - 1) * $limit;
    
    $itemId = isset($_GET['item_id']) ? intval($_GET['item_id']) : null;
    $movementType = isset($_GET['type']) ? sanitizeInput($_GET['type']) : null;
    $dateFrom = isset($_GET['date_from']) ? sanitizeInput($_GET['date_from']) : null;
    $dateTo = isset($_GET['date_to']) ? sanitizeInput($_GET['date_to']) : null;
    
    $allMovements = [];
    
    // Buscar movimentos de stock se a tabela existir
    if ($hasStockMovements) {
        $stockQuery = "
            SELECT 
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
            WHERE 1=1
        ";
        
        $stockParams = [];
        
        if ($itemId) {
            $stockQuery .= " AND sm.item_id = :item_id";
            $stockParams['item_id'] = $itemId;
        }
        
        if ($movementType && in_array($movementType, ['entrada', 'saida', 'ajuste', 'transferencia'])) {
            $stockQuery .= " AND sm.movement_type = :movement_type";
            $stockParams['movement_type'] = $movementType;
        }
        
        if ($dateFrom) {
            $stockQuery .= " AND DATE(sm.created_at) >= :date_from";
            $stockParams['date_from'] = $dateFrom;
        }
        
        if ($dateTo) {
            $stockQuery .= " AND DATE(sm.created_at) <= :date_to";
            $stockParams['date_to'] = $dateTo;
        }
        
        $stmt = $db->prepare($stockQuery);
        foreach ($stockParams as $key => $value) {
            $stmt->bindValue(":{$key}", $value);
        }
        $stmt->execute();
        $stockMovements = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $allMovements = array_merge($allMovements, $stockMovements);
    }
    
    // Buscar contagens de inventário se a tabela existir
    if ($hasInventoryCounts) {
        $countQuery = "
            SELECT 
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
            WHERE 1=1
        ";
        
        $countParams = [];
        
        if ($itemId) {
            $countQuery .= " AND ic.item_id = :item_id";
            $countParams['item_id'] = $itemId;
        }
        
        if ($movementType && $movementType === 'contagem') {
            $countQuery .= " AND ic.difference = 0";
        } elseif ($movementType === 'entrada') {
            $countQuery .= " AND ic.difference > 0";
        } elseif ($movementType === 'saida') {
            $countQuery .= " AND ic.difference < 0";
        }
        
        if ($dateFrom) {
            $countQuery .= " AND DATE(ic.counted_at) >= :date_from";
            $countParams['date_from'] = $dateFrom;
        }
        
        if ($dateTo) {
            $countQuery .= " AND DATE(ic.counted_at) <= :date_to";
            $countParams['date_to'] = $dateTo;
        }
        
        $stmt = $db->prepare($countQuery);
        foreach ($countParams as $key => $value) {
            $stmt->bindValue(":{$key}", $value);
        }
        $stmt->execute();
        $inventoryCounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $allMovements = array_merge($allMovements, $inventoryCounts);
    }
    
    // Ordenar por data (mais recente primeiro)
    usort($allMovements, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });
    
    // Aplicar paginação
    $totalMovements = count($allMovements);
    $paginatedMovements = array_slice($allMovements, $offset, $limit);
    
    // Calcular total de páginas
    $totalPages = ceil($totalMovements / $limit);
    
    sendJsonResponse([
        'success' => true,
        'movements' => $paginatedMovements,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $totalMovements,
            'pages' => $totalPages
        ],
        'debug' => [
            'has_stock_movements' => $hasStockMovements,
            'has_inventory_counts' => $hasInventoryCounts,
            'total_found' => $totalMovements
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Stock History Error: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ], 500);
}
?>
