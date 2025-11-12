<?php
/**
 * HISTORY ENHANCED API - Histórico otimizado com dados reais
 * Substitui stock_history.php com melhor performance e funcionalidade completa
 */

require_once __DIR__ . '/db.php';

// Headers CORS
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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método não permitido'
    ], 405);
}

try {
    $db = getDB();
    
    // === PARÂMETROS DE FILTRO ===
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;
    $offset = ($page - 1) * $limit;
    
    $itemId = isset($_GET['item_id']) ? intval($_GET['item_id']) : null;
    $userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
    $sessionId = isset($_GET['session_id']) ? intval($_GET['session_id']) : null;
    $movementType = isset($_GET['type']) ? sanitizeInput($_GET['type']) : null;
    $dateFrom = isset($_GET['date_from']) ? sanitizeInput($_GET['date_from']) : null;
    $dateTo = isset($_GET['date_to']) ? sanitizeInput($_GET['date_to']) : null;
    $search = isset($_GET['search']) ? sanitizeInput($_GET['search']) : null;
    
    // === CONSTRUIR QUERY OTIMIZADA ===
    
    // Base query para contagens de inventário (dados principais)
    // Usar LEFT JOIN para items para incluir contagens mesmo se item foi deletado
    // NOTA: user_id está na tabela inventory_sessions, não em inventory_counts
    $countQuery = "
        SELECT 
            CONCAT('count_', ic.id) as id,
            'inventory_count' as source_type,
            ic.item_id,
            COALESCE(i.barcode, 'N/A') as barcode,
            COALESCE(i.name, 'Item Removido') as item_name,
            CASE 
                WHEN ic.difference > 0 THEN 'entrada'
                WHEN ic.difference < 0 THEN 'saida'
                ELSE 'contagem'
            END as type,
            ic.difference as quantity,
            ic.counted_quantity,
            ic.expected_quantity,
            CONCAT('Contagem: ', ic.counted_quantity, ' (esperado: ', ic.expected_quantity, ')') as description,
            s.user_id,
            COALESCE(u.username, 'Sistema') as user_name,
            ic.session_id,
            COALESCE(s.name, 'Sessão Removida') as session_name,
            ic.counted_at as created_at
        FROM inventory_counts ic
        LEFT JOIN items i ON ic.item_id = i.id
        LEFT JOIN inventory_sessions s ON ic.session_id = s.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE 1=1
    ";
    
    // Base query para movimentos de stock (se existir)
    $movementQuery = "
        SELECT 
            CONCAT('movement_', sm.id) as id,
            'stock_movement' as source_type,
            sm.item_id,
            i.barcode,
            i.name as item_name,
            sm.movement_type as type,
            sm.quantity,
            NULL as counted_quantity,
            NULL as expected_quantity,
            sm.reason as description,
            sm.user_id,
            u.username as user_name,
            NULL as session_id,
            NULL as session_name,
            sm.created_at
        FROM stock_movements sm
        INNER JOIN items i ON sm.item_id = i.id
        LEFT JOIN users u ON sm.user_id = u.id
        WHERE 1=1
    ";
    
    // === APLICAR FILTROS ===
    $countParams = [];
    $movementParams = [];
    
    // Filtro por item
    if ($itemId) {
        $countQuery .= " AND ic.item_id = :item_id";
        $movementQuery .= " AND sm.item_id = :item_id";
        $countParams['item_id'] = $itemId;
        $movementParams['item_id'] = $itemId;
    }
    
    // Filtro por usuário
    // NOTA: Para contagens, user_id está na sessão (s.user_id), não na contagem
    if ($userId) {
        $countQuery .= " AND s.user_id = :user_id";
        $movementQuery .= " AND sm.user_id = :user_id";
        $countParams['user_id'] = $userId;
        $movementParams['user_id'] = $userId;
    }
    
    // Filtro por sessão
    if ($sessionId) {
        $countQuery .= " AND ic.session_id = :session_id";
        $countParams['session_id'] = $sessionId;
    }
    
    // Filtro por tipo
    if ($movementType) {
        if ($movementType === 'contagem') {
            $countQuery .= " AND ic.difference = 0";
        } elseif ($movementType === 'entrada') {
            $countQuery .= " AND ic.difference > 0";
            $movementQuery .= " AND sm.movement_type = 'entrada'";
        } elseif ($movementType === 'saida') {
            $countQuery .= " AND ic.difference < 0";
            $movementQuery .= " AND sm.movement_type = 'saida'";
        } elseif (in_array($movementType, ['ajuste', 'transferencia'])) {
            $movementQuery .= " AND sm.movement_type = :movement_type";
            $movementParams['movement_type'] = $movementType;
            // Excluir contagens para tipos específicos de movimento
            $countQuery .= " AND 1=0";
        }
    }
    
    // Filtro por data
    if ($dateFrom) {
        $countQuery .= " AND DATE(ic.counted_at) >= :date_from";
        $movementQuery .= " AND DATE(sm.created_at) >= :date_from";
        $countParams['date_from'] = $dateFrom;
        $movementParams['date_from'] = $dateFrom;
    }
    
    if ($dateTo) {
        $countQuery .= " AND DATE(ic.counted_at) <= :date_to";
        $movementQuery .= " AND DATE(sm.created_at) <= :date_to";
        $countParams['date_to'] = $dateTo;
        $movementParams['date_to'] = $dateTo;
    }
    
    // Filtro por pesquisa (nome do item ou código de barras)
    if ($search) {
        $searchTerm = "%$search%";
        $countQuery .= " AND (i.name LIKE :search OR i.barcode LIKE :search)";
        $movementQuery .= " AND (i.name LIKE :search OR i.barcode LIKE :search)";
        $countParams['search'] = $searchTerm;
        $movementParams['search'] = $searchTerm;
    }
    
    // === EXECUTAR QUERIES ===
    $allMovements = [];
    $debugInfo = [];
    
    // Executar query de contagens
    try {
        // Debug: verificar se há dados na tabela
        $totalCountsCheck = $db->query("SELECT COUNT(*) FROM inventory_counts")->fetchColumn();
        $debugInfo['total_counts_in_db'] = (int)$totalCountsCheck;
        
        // Debug: verificar se há items (para JOIN)
        $totalItemsCheck = $db->query("SELECT COUNT(*) FROM items")->fetchColumn();
        $debugInfo['total_items_in_db'] = (int)$totalItemsCheck;
        
        // Debug: verificar contagens sem JOIN primeiro
        $countsWithoutJoin = $db->query("SELECT COUNT(*) FROM inventory_counts")->fetchColumn();
        $debugInfo['counts_without_join'] = (int)$countsWithoutJoin;
        
        // Testar query simples com LEFT JOIN
        $simpleTestQuery = "
            SELECT COUNT(*) 
            FROM inventory_counts ic
            LEFT JOIN items i ON ic.item_id = i.id
        ";
        $countsWithJoin = $db->query($simpleTestQuery)->fetchColumn();
        $debugInfo['counts_with_join'] = (int)$countsWithJoin;
        
        // Verificar se há contagens órfãs (sem items)
        $orphanedCounts = $db->query("
            SELECT COUNT(*) 
            FROM inventory_counts ic
            LEFT JOIN items i ON ic.item_id = i.id
            WHERE i.id IS NULL
        ")->fetchColumn();
        $debugInfo['orphaned_counts'] = (int)$orphanedCounts;
        
        $stmt = $db->prepare($countQuery);
        foreach ($countParams as $key => $value) {
            $stmt->bindValue(":{$key}", $value);
        }
        $stmt->execute();
        $inventoryCounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $debugInfo['counts_found'] = count($inventoryCounts);
        $debugInfo['count_query'] = substr($countQuery, 0, 500); // Limitar tamanho
        $debugInfo['count_params'] = $countParams;
        $allMovements = array_merge($allMovements, $inventoryCounts);
    } catch (Exception $e) {
        error_log("Inventory counts query error: " . $e->getMessage());
        $debugInfo['counts_error'] = $e->getMessage();
        $debugInfo['count_query'] = substr($countQuery, 0, 500);
    }
    
    // Executar query de movimentos (se tabela existir)
    try {
        $checkMovements = $db->query("SHOW TABLES LIKE 'stock_movements'")->rowCount() > 0;
        if ($checkMovements) {
            $stmt = $db->prepare($movementQuery);
            foreach ($movementParams as $key => $value) {
                $stmt->bindValue(":{$key}", $value);
            }
            $stmt->execute();
            $stockMovements = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $allMovements = array_merge($allMovements, $stockMovements);
        }
    } catch (Exception $e) {
        error_log("Stock movements query error: " . $e->getMessage());
    }
    
    // === ORDENAR E PAGINAR ===
    
    // Ordenar por data (mais recente primeiro)
    usort($allMovements, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });
    
    // Calcular totais
    $totalMovements = count($allMovements);
    $totalPages = ceil($totalMovements / $limit);
    
    // Aplicar paginação
    $paginatedMovements = array_slice($allMovements, $offset, $limit);
    
    // === ESTATÍSTICAS ADICIONAIS ===
    $statistics = [
        'total_records' => $totalMovements,
        'by_type' => [],
        'by_date' => [],
        'accuracy_rate' => 0
    ];
    
    // Contar por tipo
    foreach ($allMovements as $movement) {
        $type = $movement['type'];
        $statistics['by_type'][$type] = ($statistics['by_type'][$type] ?? 0) + 1;
    }
    
    // Calcular taxa de precisão (apenas para contagens)
    $totalCounts = 0;
    $accurateCounts = 0;
    foreach ($allMovements as $movement) {
        if ($movement['source_type'] === 'inventory_count') {
            $totalCounts++;
            if ($movement['type'] === 'contagem') {
                $accurateCounts++;
            }
        }
    }
    
    $statistics['accuracy_rate'] = $totalCounts > 0 ? round(($accurateCounts / $totalCounts) * 100, 1) : 0;
    
    // === RESPOSTA FINAL ===
    sendJsonResponse([
        'success' => true,
        'movements' => $paginatedMovements,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $totalMovements,
            'pages' => $totalPages,
            'has_next' => $page < $totalPages,
            'has_prev' => $page > 1
        ],
        'statistics' => $statistics,
        'filters' => [
            'item_id' => $itemId,
            'user_id' => $userId,
            'session_id' => $sessionId,
            'type' => $movementType,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'search' => $search
        ],
        'metadata' => [
            'generated_at' => date('Y-m-d H:i:s'),
            'data_source' => 'real_database',
            'performance' => 'optimized'
        ],
        'debug' => $debugInfo
    ]);
    
} catch (Exception $e) {
    error_log("History Enhanced Error: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro interno do servidor',
        'error' => $e->getMessage()
    ], 500);
}
?>
