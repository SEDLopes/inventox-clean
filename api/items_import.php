<?php
/**
 * InventoX - Items Import API
 * Endpoint para importação de artigos (CSV/XLSX)
 */

require_once __DIR__ . '/db.php';

// Headers CORS (ANTES da autenticação)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verificar autenticação (requireAuth já inicia a sessão se necessário)
requireAuth();

// CSRF protection (exceto para FormData que não envia token facilmente)
// Para uploads, validar por outros meios (autenticação já é suficiente)

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método não permitido'
    ], 405);
}

// Verificar se há ficheiro enviado
if (!isset($_FILES['file'])) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Nenhum ficheiro foi enviado'
    ], 400);
}

if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorMsg = 'Erro desconhecido';
    switch ($_FILES['file']['error']) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            $errorMsg = 'Ficheiro demasiado grande';
            break;
        case UPLOAD_ERR_PARTIAL:
            $errorMsg = 'Ficheiro enviado parcialmente';
            break;
        case UPLOAD_ERR_NO_FILE:
            $errorMsg = 'Nenhum ficheiro foi enviado';
            break;
        case UPLOAD_ERR_NO_TMP_DIR:
            $errorMsg = 'Diretório temporário não encontrado';
            break;
        case UPLOAD_ERR_CANT_WRITE:
            $errorMsg = 'Erro ao escrever ficheiro';
            break;
        case UPLOAD_ERR_EXTENSION:
            $errorMsg = 'Extensão bloqueada';
            break;
    }
    error_log("Items import - Upload error: " . $_FILES['file']['error'] . " - $errorMsg");
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao enviar ficheiro: ' . $errorMsg
    ], 400);
}

$file = $_FILES['file'];
$fileName = $file['name'];
$fileTmpPath = $file['tmp_name'];
$fileSize = $file['size'];
$fileType = $file['type'];

// Validar tipo de ficheiro
$allowedTypes = ['text/csv', 'application/vnd.ms-excel', 
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
$allowedExtensions = ['csv', 'xls', 'xlsx'];
$fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

if (!in_array($fileExtension, $allowedExtensions)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Tipo de ficheiro não permitido. Use CSV ou XLSX.'
    ], 400);
}

// Limitar tamanho do ficheiro (10MB)
$maxSize = 10 * 1024 * 1024;
if ($fileSize > $maxSize) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Ficheiro demasiado grande. Máximo: 10MB'
    ], 400);
}

try {
    // Mover ficheiro para uploads
    $uploadDir = __DIR__ . '/../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $newFileName = date('Y-m-d_His') . '_' . uniqid() . '.' . $fileExtension;
    $uploadPath = $uploadDir . $newFileName;

    if (!move_uploaded_file($fileTmpPath, $uploadPath)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Erro ao guardar ficheiro'
        ], 500);
    }

    // Se for CSV, processar diretamente em PHP (fallback mais fiável)
    if ($fileExtension === 'csv') {
        $imported = 0;
        $updated = 0;
        $errors = [];
        $db = getDB();

        $fileHandle = fopen($uploadPath, 'r');
        if ($fileHandle === FALSE) {
            @unlink($uploadPath);
            sendJsonResponse(['success' => false, 'message' => 'Não foi possível abrir o ficheiro CSV.'], 500);
        }

        // Detectar BOM e remover se presente
        $firstLine = fgets($fileHandle);
        if (str_starts_with($firstLine, "\xEF\xBB\xBF")) {
            $firstLine = substr($firstLine, 3);
        }
        rewind($fileHandle); // Voltar ao início do ficheiro

        // Detectar delimitador (vírgula ou ponto e vírgula)
        $delimiter = ',';
        if (str_contains($firstLine, ';') && !str_contains($firstLine, ',')) {
            $delimiter = ';';
        }

        $headers = fgetcsv($fileHandle, 0, $delimiter);
        if ($headers === FALSE) {
            fclose($fileHandle);
            @unlink($uploadPath);
            sendJsonResponse(['success' => false, 'message' => 'Não foi possível ler os cabeçalhos do ficheiro CSV.'], 500);
        }
        $headers = array_map('trim', $headers);
        $headers = array_map('strtolower', $headers);

        // Mapeamento de colunas (incluindo variações com acentos e pontuação)
        $columnMapping = [
            'barcode' => ['barcode', 'codigo_barras', 'código_barras', 'cód._barras', 'cod._barras', 'codigo'],
            'name' => ['name', 'nome', 'artigo', 'produto'],
            'description' => ['description', 'descricao', 'descrição'],
            'category' => ['category', 'categoria'],
            'quantity' => ['quantity', 'quantidade', 'qtd', 'qtd._stock', 'qtd_stock', 'stock'],
            'min_quantity' => ['min_quantity', 'quantidade_minima', 'qtd_minima'],
            'unit_price' => ['unit_price', 'preco_unitario', 'preço_unitario', 'custo_unitário', 'preco', 'preço', 'pvp', 'pvp1'],
            'location' => ['location', 'localizacao', 'localização'],
            'supplier' => ['supplier', 'fornecedor']
        ];

        $mappedHeaders = [];
        foreach ($columnMapping as $dbCol => $possibleHeaders) {
            foreach ($possibleHeaders as $ph) {
                if (in_array($ph, $headers)) {
                    $mappedHeaders[$dbCol] = array_search($ph, $headers);
                    break;
                }
            }
        }

        // Validar colunas obrigatórias
        $requiredCols = ['barcode', 'name'];
        $missingCols = [];
        foreach ($requiredCols as $col) {
            if (!isset($mappedHeaders[$col])) {
                $missingCols[] = $col;
            }
        }
        if (!empty($missingCols)) {
            fclose($fileHandle);
            @unlink($uploadPath);
            sendJsonResponse(['success' => false, 'message' => 'Colunas obrigatórias em falta no CSV: ' . implode(', ', $missingCols)], 400);
        }

        // Aumentar timeout e memória para importações grandes
        set_time_limit(900); // 15 minutos para importações muito grandes
        ini_set('max_execution_time', 900);
        ini_set('memory_limit', '512M'); // Aumentar memória para grandes importações
        
        $db = getDB();
        $imported = 0; $updated = 0; $errors = [];
        $skipped = 0; // Linhas ignoradas (vazias, inválidas, etc.)
        $totalProcessed = 0; // Total de linhas processadas
        
        // Cache de categorias para evitar queries repetidas
        $categoryCache = [];
        $stmtCat = $db->prepare("SELECT id, name FROM categories");
        $stmtCat->execute();
        $allCategories = $stmtCat->fetchAll(PDO::FETCH_ASSOC);
        foreach ($allCategories as $cat) {
            $categoryCache[strtolower(trim($cat['name']))] = $cat['id'];
        }
        
        // Contar total de linhas para progresso (aproximado)
        $totalLines = 0;
        $fileHandleForCount = fopen($uploadPath, 'r');
        if ($fileHandleForCount) {
            while (fgetcsv($fileHandleForCount, 0, $delimiter) !== FALSE) {
                $totalLines++;
            }
            fclose($fileHandleForCount);
        }
        $totalLines = max(1, $totalLines - 1); // Menos 1 para o header
        
        // Iniciar transação para melhor performance
        $db->beginTransaction();
        $batchSize = 100; // Processar em lotes de 100
        $currentBatch = 0;

        $lineNum = 1; // Começa em 1 para o header, dados começam na linha 2
        while (($rowData = fgetcsv($fileHandle, 0, $delimiter)) !== FALSE) {
            $lineNum++;
            $totalProcessed++;
            
            // Verificar se linha está vazia
            $isEmpty = true;
            foreach ($rowData as $cell) {
                if (trim($cell) !== '') {
                    $isEmpty = false;
                    break;
                }
            }
            if ($isEmpty) {
                $skipped++;
                continue; // Ignorar linhas completamente vazias
            }
            
            if (count($rowData) != count($headers)) {
                $errors[] = "Linha {$lineNum}: Número de colunas inconsistente (esperado: " . count($headers) . ", encontrado: " . count($rowData) . ").";
                $skipped++;
                continue;
            }

            $itemData = [];
            foreach ($mappedHeaders as $dbCol => $colIndex) {
                $itemData[$dbCol] = isset($rowData[$colIndex]) ? trim($rowData[$colIndex]) : '';
            }

            try {
                $barcode = $itemData['barcode'] ?? '';
                $name = $itemData['name'] ?? '';

                if (empty($barcode) || empty($name)) {
                    $errors[] = "Linha {$lineNum}: Código de barras e nome são obrigatórios (barcode: '{$barcode}', name: '{$name}').";
                    $skipped++;
                    continue;
                }

                // Processar categoria (usar cache)
                $categoryId = null;
                if (!empty($itemData['category'])) {
                    $categoryNameLower = strtolower(trim($itemData['category']));
                    if (isset($categoryCache[$categoryNameLower])) {
                        $categoryId = $categoryCache[$categoryNameLower];
                    } else {
                        // Criar nova categoria e adicionar ao cache
                        $stmtInsertCat = $db->prepare("INSERT INTO categories (name) VALUES (:name)");
                        $stmtInsertCat->execute(['name' => $itemData['category']]);
                        $categoryId = $db->lastInsertId();
                        $categoryCache[$categoryNameLower] = $categoryId;
                    }
                }

                // Verificar se artigo existe
                $stmtCheckItem = $db->prepare("SELECT id FROM items WHERE barcode = :barcode");
                $stmtCheckItem->execute(['barcode' => $barcode]);
                $existingItem = $stmtCheckItem->fetch();

                $params = [
                    'barcode' => $barcode,
                    'name' => $name,
                    'description' => $itemData['description'] ?: null,
                    'category_id' => $categoryId,
                    'quantity' => intval($itemData['quantity'] ?? 0),
                    'min_quantity' => intval($itemData['min_quantity'] ?? 0),
                    'unit_price' => floatval($itemData['unit_price'] ?? 0),
                    'location' => $itemData['location'] ?: null,
                    'supplier' => $itemData['supplier'] ?: null
                ];

                if ($existingItem) {
                    // Atualizar
                    $updateParams = [];
                    $updateFields = [];
                    foreach ($params as $key => $value) {
                        if ($key !== 'barcode') { // Não atualizar barcode
                            $updateFields[] = "{$key} = :{$key}";
                            $updateParams[$key] = $value;
                        }
                    }
                    $updateParams['id'] = $existingItem['id'];
                    $stmtUpdate = $db->prepare("UPDATE items SET " . implode(', ', $updateFields) . " WHERE id = :id");
                    $stmtUpdate->execute($updateParams);
                    $updated++;
                } else {
                    // Inserir - usar INSERT IGNORE ou ON DUPLICATE KEY UPDATE para evitar erros
                    try {
                        $stmtInsert = $db->prepare("
                            INSERT INTO items (barcode, name, description, category_id, quantity, min_quantity, unit_price, location, supplier)
                            VALUES (:barcode, :name, :description, :category_id, :quantity, :min_quantity, :unit_price, :location, :supplier)
                        ");
                        $stmtInsert->execute($params);
                        
                        // Verificar se realmente foi inserido (pode falhar silenciosamente se houver duplicado)
                        $verifyStmt = $db->prepare("SELECT id FROM items WHERE barcode = :barcode");
                        $verifyStmt->execute(['barcode' => $barcode]);
                        $verified = $verifyStmt->fetch();
                        
                        if ($verified) {
                            $imported++;
                        } else {
                            // Não foi inserido - provavelmente duplicado ou outro erro
                            $errors[] = "Linha {$lineNum}: Falha ao inserir artigo '{$name}' (barcode: {$barcode}) - possível duplicado ou erro de constraint";
                            $skipped++;
                            error_log("Items import - Failed to insert item at line {$lineNum}: barcode={$barcode}, name={$name}");
                        }
                    } catch (PDOException $pdoErr) {
                        // Capturar erros de constraint (duplicados, etc.)
                        $errorCode = $pdoErr->getCode();
                        $errorMessage = $pdoErr->getMessage();
                        
                        if ($errorCode == 23000 || strpos($errorMessage, 'Duplicate entry') !== false || strpos($errorMessage, 'UNIQUE constraint') !== false) {
                            // Duplicado - tentar atualizar em vez de inserir
                            $stmtCheckAgain = $db->prepare("SELECT id FROM items WHERE barcode = :barcode");
                            $stmtCheckAgain->execute(['barcode' => $barcode]);
                            $duplicateItem = $stmtCheckAgain->fetch();
                            
                            if ($duplicateItem) {
                                // Atualizar o duplicado
                                $updateParams = [];
                                $updateFields = [];
                                foreach ($params as $key => $value) {
                                    if ($key !== 'barcode') {
                                        $updateFields[] = "{$key} = :{$key}";
                                        $updateParams[$key] = $value;
                                    }
                                }
                                $updateParams['id'] = $duplicateItem['id'];
                                $stmtUpdate = $db->prepare("UPDATE items SET " . implode(', ', $updateFields) . " WHERE id = :id");
                                $stmtUpdate->execute($updateParams);
                                $updated++;
                                $errors[] = "Linha {$lineNum}: Artigo '{$name}' (barcode: {$barcode}) já existe - foi atualizado em vez de inserido";
                            } else {
                                $errors[] = "Linha {$lineNum}: Erro ao inserir '{$name}' (barcode: {$barcode}) - {$errorMessage}";
                                $skipped++;
                            }
                        } else {
                            // Outro tipo de erro
                            $errors[] = "Linha {$lineNum}: Erro ao inserir '{$name}' (barcode: {$barcode}) - {$errorMessage}";
                            $skipped++;
                            error_log("Items import - PDO error at line {$lineNum}: " . $errorMessage);
                        }
                    }
                }
                
                // Commit em batch para melhor performance
                $currentBatch++;
                if ($currentBatch >= $batchSize) {
                    $db->commit();
                    $db->beginTransaction();
                    $currentBatch = 0;
                }
            } catch (Exception $er) {
                $errors[] = "Linha {$lineNum}: " . $er->getMessage();
                $skipped++;
                error_log("Items import - Line {$lineNum} error: " . $er->getMessage());
                // Continuar mesmo com erro, mas não incrementar batch
                continue;
            }
        }

        // Commit final da transação
        try {
            $db->commit();
        } catch (Exception $e) {
            $db->rollback();
            error_log("Import transaction error: " . $e->getMessage());
            fclose($fileHandle);
            @unlink($uploadPath);
            sendJsonResponse([
                'success' => false,
                'message' => 'Erro ao finalizar importação: ' . $e->getMessage()
            ], 500);
            return;
        }

        fclose($fileHandle);
        @unlink($uploadPath);

        // Log resumo da importação
        error_log("Items import completed - Total lines: {$totalLines}, Processed: {$totalProcessed}, Imported: {$imported}, Updated: {$updated}, Skipped: {$skipped}, Errors: " . count($errors));
        
        // Mensagem mais clara: importados são NOVOS artigos, atualizados são artigos que já existiam
        $message = "Importação CSV concluída: {$imported} novos artigos importados, {$updated} artigos atualizados";
        if ($skipped > 0) {
            $message .= ", {$skipped} linhas ignoradas";
        }
        if (count($errors) > 0) {
            $message .= ", " . count($errors) . " erros";
        }
        $message .= ".";
        
        // Adicionar aviso se muitos foram atualizados em vez de importados
        if ($updated > $imported && $updated > 100) {
            $message .= " Nota: Muitos artigos foram atualizados (já existiam na base de dados).";
        }
        
        sendJsonResponse([
            'success' => true,
            'message' => $message,
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
            'total_lines' => $totalLines,
            'processed' => $totalProcessed,
            'summary' => [
                'total_lines_in_file' => $totalLines,
                'lines_processed' => $totalProcessed,
                'lines_imported' => $imported,
                'lines_updated' => $updated,
                'lines_skipped' => $skipped,
                'errors_count' => count($errors),
                'success_rate' => $totalProcessed > 0 ? round((($imported + $updated) / $totalProcessed) * 100, 2) . '%' : '0%'
            ]
        ]);
    }

    // Ficheiros XLS/XLSX: tentar via Python se disponível
    $pythonScript = __DIR__ . '/../scripts/import_items.py';
    
    // Verificar se Python está disponível
    $pythonCheck = [];
    $pythonCheckCode = 0;
    exec("which python3 2>&1", $pythonCheck, $pythonCheckCode);
    
    if ($pythonCheckCode !== 0) {
        error_log("Items import - Error: Python3 not found");
        @unlink($uploadPath);
        sendJsonResponse([
            'success' => false,
            'message' => 'Python3 não está disponível no servidor. Contacte o administrador.'
        ], 500);
    }
    
    // Verificar se o script Python existe
    if (!file_exists($pythonScript)) {
        error_log("Items import - Error: Python script not found at $pythonScript");
        @unlink($uploadPath);
        sendJsonResponse([
            'success' => false,
            'message' => 'Script de importação não encontrado. Contacte o administrador.'
        ], 500);
    }
    
    $command = escapeshellcmd("python3 " . $pythonScript . " " . escapeshellarg($uploadPath));
    
    $output = [];
    $returnCode = 0;
    exec($command . " 2>&1", $output, $returnCode);

    if ($returnCode !== 0) {
        // Falhou Python: devolver erro claro
        error_log("Items import - Python import error (return code $returnCode): " . implode("\n", $output));
        
        $errorMessage = implode("\n", $output);
        if (empty($errorMessage)) {
            $errorMessage = "Erro desconhecido ao processar ficheiro XLSX";
        }
        
        sendJsonResponse([
            'success' => false,
            'message' => 'Falha a processar XLS/XLSX: ' . $errorMessage,
            'details' => $output,
            'return_code' => $returnCode
        ], 500);
    }

    @unlink($uploadPath);

    $outputString = implode("\n", $output);
    $result = json_decode($outputString, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("Items import - JSON decode error: " . json_last_error_msg());
        sendJsonResponse([
            'success' => false,
            'message' => 'Erro ao processar resposta do script de importação: ' . json_last_error_msg()
        ], 500);
    }
    
    if ($result && isset($result['success'])) {
        sendJsonResponse([
            'success' => true,
            'message' => $result['message'] ?? 'Importação concluída',
            'imported' => $result['imported'] ?? 0,
            'updated' => $result['updated'] ?? 0,
            'errors' => $result['errors'] ?? []
        ]);
    }
    
    error_log("Items import - Warning: Unexpected result format");
    sendJsonResponse([
        'success' => false,
        'message' => 'Formato de resposta inesperado do script de importação'
    ], 500);

} catch (Exception $e) {
    error_log("Import error: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao processar importação: ' . $e->getMessage()
    ], 500);
}

