/**
 * InventoX - Frontend Application
 * Gestão de Inventário com Scanner de Código de Barras
 * 
 * Versão: 1.1.0
 * Última atualização: 2024-11-08
 */

// Base da API: usar o mesmo domínio/host da app (funciona em dev e produção)
const API_BASE = `${location.origin.replace(/\/$/, '')}/api`;

// Usar logger condicional se disponível
const log = window.logger || console;
const logError = window.logger?.error || console.error;
const logWarn = window.logger?.warn || console.warn;
const logDebug = window.logger?.debug || (() => {});
let currentSessionId = null;
let currentItemId = null;
let currentBarcode = null;
let currentItemsPage = 1;
let currentItemsSearch = '';
let currentUsersPage = 1;
let currentUsersSearch = '';
let currentHistoryPage = 1;
let currentCategoriesSearch = '';
let scanner = null;
let codeReader = null;
let isMobileDevice = false;
let cameraPermissionGranted = false;
let availableCameras = [];
let currentCameraId = null;
let currentFacingMode = 'environment';
const isIOSDevice = (() => {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    return (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1));
})();

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    detectMobileDevice();
    checkAuth();
    initEventListeners();
    
    // Aguardar ZXing carregar (pode levar alguns milissegundos)
    setTimeout(() => {
        initZXing();
        if (isMobileDevice) {
            requestCameraPermissionOnMobile();
        }
    }, 100);
});

// Verificar autenticação
async function checkAuth() {
    // Verificar se existe sessão no sessionStorage
    const username = sessionStorage.getItem('username');
    if (username) {
        // Verificar se a sessão ainda é válida no servidor
        try {
            const response = await fetch(`${API_BASE}/stats.php`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                // Sessão válida, mostrar dashboard
                showDashboard(username);
                return;
            } else {
                // Sessão inválida, limpar dados locais
                log.debug('Sessão expirada, limpando dados locais');
                sessionStorage.clear();
            }
        } catch (error) {
            // Erro na verificação, limpar dados locais
            log.debug('Erro ao verificar sessão, limpando dados locais');
            sessionStorage.clear();
        }
    }
    
    // Mostrar login se não há sessão válida
    showLogin();
}

// Mostrar login
function showLogin() {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    if (loginSection) loginSection.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
}

// Mostrar dashboard
function showDashboard(username) {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginSection) loginSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');
    if (userInfo) userInfo.textContent = `Olá, ${username}`;
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    
    // Verificar role do utilizador e mostrar tabs apropriadas
    const userRole = sessionStorage.getItem('userRole');
    const usersTabBtn = document.getElementById('usersTabBtn');
    const historyTabBtn = document.getElementById('historyTabBtn');
    // const analyticsTabBtn = document.getElementById('analyticsTabBtn'); // DISABLED
    const deleteAllItemsBtn = document.getElementById('deleteAllItemsBtn');
    
    if (userRole === 'admin') {
        if (usersTabBtn) usersTabBtn.classList.remove('hidden');
        if (historyTabBtn) historyTabBtn.classList.remove('hidden');
        // if (analyticsTabBtn) analyticsTabBtn.classList.remove('hidden'); // DISABLED
        if (deleteAllItemsBtn) deleteAllItemsBtn.classList.remove('hidden');
    } else {
        if (usersTabBtn) usersTabBtn.classList.add('hidden');
        if (historyTabBtn) historyTabBtn.classList.add('hidden');
        // if (analyticsTabBtn) analyticsTabBtn.classList.add('hidden'); // DISABLED
        if (deleteAllItemsBtn) deleteAllItemsBtn.classList.add('hidden');
    }
    
    // Carregar dados do dashboard
    loadDashboard();
    loadSessions();
}

// Event Listeners
function initEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
            
            // Carregar dados quando mudar de tab
            if (tabName === 'dashboard') {
                loadDashboard();
            } else if (tabName === 'items') {
                loadItems();
            } else if (tabName === 'categories') {
                loadCategories();
            } else if (tabName === 'history') {
                loadStockHistory();
            } else if (tabName === 'users') {
                loadUsers();
            } else if (tabName === 'companies') {
                loadCompanies();
            } else if (tabName === 'warehouses') {
                loadWarehouses();
            }
        });
    });
    
    // Scanner
    document.getElementById('startScannerBtn').addEventListener('click', showCountSetupModal);
    document.getElementById('stopScannerBtn').addEventListener('click', stopScanner);
    const switchBtn = document.getElementById('switchCameraBtn');
    if (switchBtn) {
        switchBtn.addEventListener('click', async () => {
                logDebug('Switch camera clicked - current facing mode:', currentFacingMode);
                // Em mobile, sempre alternar por facingMode (mais confiável)
                if (isMobileDevice) {
                    const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
                    logDebug('Switching to facing mode:', newFacingMode);
                await switchCamera(null, newFacingMode);
            } else if (availableCameras && availableCameras.length > 1) {
                const idx = availableCameras.findIndex(d => d.deviceId === currentCameraId);
                const nextIdx = (idx >= 0 ? idx + 1 : 0) % availableCameras.length;
                await switchCamera(availableCameras[nextIdx].deviceId);
            } else {
                showToast('Nenhuma câmara alternativa disponível', 'warning');
            }
        });
    }
    const cameraSelect = document.getElementById('cameraSelect');
    if (cameraSelect) {
        cameraSelect.addEventListener('change', async (e) => {
            const deviceId = e.target.value;
            if (deviceId && deviceId !== currentCameraId) {
                await switchCamera(deviceId);
            }
        });
    }
    document.getElementById('manualBarcode').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBarcode(e.target.value);
        }
    });
    
    // Botão de processar código manual
    const processManualBtn = document.getElementById('processManualBtn');
    if (processManualBtn) {
        processManualBtn.addEventListener('click', () => {
            const manualBarcodeField = document.getElementById('manualBarcode');
            if (manualBarcodeField && manualBarcodeField.value.trim()) {
                handleBarcode(manualBarcodeField.value.trim());
            } else {
                showToast('Digite um código de barras primeiro', 'warning');
            }
        });
    }
    
    // Session
    const createSessionBtn = document.getElementById('createSessionBtn');
    if (createSessionBtn) {
        createSessionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modal = document.getElementById('createSessionModal');
            if (modal) {
                // Limpar formulário antes de abrir
                const form = document.getElementById('createSessionForm');
                if (form) {
                    form.reset();
                }
                // Carregar empresas e resetar armazém
                loadCompaniesForSession();
                const warehouseSelect = document.getElementById('newSessionWarehouse');
                if (warehouseSelect) {
                    warehouseSelect.innerHTML = '<option value="">Primeiro selecione uma empresa</option>';
                    warehouseSelect.disabled = true;
                    warehouseSelect.classList.add('bg-gray-100');
                }
                modal.classList.remove('hidden');
            }
        });
    }
    
    const createSessionForm = document.getElementById('createSessionForm');
    if (createSessionForm) {
        createSessionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Verificar se o formulário foi realmente submetido pelo utilizador
            // (não por validação automática do navegador)
            const submitButton = e.submitter;
            if (submitButton && submitButton.type === 'submit') {
                createSession();
            }
        });
    }
    
    const closeCreateSessionBtn = document.getElementById('closeCreateSession');
    const cancelCreateSessionBtn = document.getElementById('cancelCreateSession');
    if (closeCreateSessionBtn) {
        closeCreateSessionBtn.addEventListener('click', () => {
            const modal = document.getElementById('createSessionModal');
            if (modal) modal.classList.add('hidden');
        });
    }
    if (cancelCreateSessionBtn) {
        cancelCreateSessionBtn.addEventListener('click', () => {
            const modal = document.getElementById('createSessionModal');
            if (modal) modal.classList.add('hidden');
        });
    }
    
    // Event listener para mudança de empresa no modal de criação de sessão
    const newSessionCompany = document.getElementById('newSessionCompany');
    if (newSessionCompany) {
        newSessionCompany.addEventListener('change', handleNewSessionCompanyChange);
    }
    
    const sessionSelect = document.getElementById('sessionSelect');
    if (sessionSelect) {
        sessionSelect.addEventListener('change', (e) => {
            currentSessionId = e.target.value;
            if (currentSessionId) {
                loadSessionInfo(currentSessionId, true); // Mostrar detalhes quando selecionado manualmente
            }
        });
    }
    
    // Event listener para fechar o card de detalhes da sessão
    const closeSessionDetailsBtn = document.getElementById('closeSessionDetails');
    if (closeSessionDetailsBtn) {
        closeSessionDetailsBtn.addEventListener('click', closeSessionDetails);
    }
    
    // Item count
    const saveCountBtn = document.getElementById('saveCountBtn');
    if (saveCountBtn) {
        saveCountBtn.addEventListener('click', saveCount);
    }
    
    // Import
    const importFile = document.getElementById('importFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const importForm = document.getElementById('importForm');
    if (importFile && uploadBtn) {
        uploadBtn.disabled = !importFile.files.length;
        importFile.addEventListener('change', (e) => {
            uploadBtn.disabled = !e.target.files.length;
        });
    }
    if (importForm) {
        importForm.addEventListener('submit', (e) => {
            e.preventDefault();
            uploadFile();
        });
    }
    
    // Refresh sessions
    const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');
    if (refreshSessionsBtn) {
        refreshSessionsBtn.addEventListener('click', loadSessions);
    }

    // Items - filtro de stock baixo
    const lowStockCheckbox = document.getElementById('itemsLowStockOnly');
    if (lowStockCheckbox) {
        lowStockCheckbox.addEventListener('change', () => loadItems(1));
    }
    
    // Items management (elementos podem não existir em todas as vistas)
    const addItemBtn = document.getElementById('addItemBtn');
    if (addItemBtn) addItemBtn.addEventListener('click', () => openItemModal());
    const itemForm = document.getElementById('itemForm');
    if (itemForm) itemForm.addEventListener('submit', saveItem);
    const searchItemsBtn = document.getElementById('searchItemsBtn');
    if (searchItemsBtn) searchItemsBtn.addEventListener('click', () => loadItems(1));
    const itemsSearch = document.getElementById('itemsSearch');
    if (itemsSearch) {
        itemsSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadItems(1);
            }
        });
    }
    
    // Categories management
    const createCategoryBtn = document.getElementById('createCategoryBtn');
    if (createCategoryBtn) {
        createCategoryBtn.addEventListener('click', () => openCategoryModal());
    }
    const categoryForm = document.getElementById('categoryForm');
    if (categoryForm) {
        categoryForm.addEventListener('submit', saveCategory);
    }
    const categorySearch = document.getElementById('categorySearch');
    if (categorySearch) {
        categorySearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadCategories();
            }
        });
        categorySearch.addEventListener('input', (e) => {
            // Debounce: carregar após 500ms sem digitar
            clearTimeout(categorySearch.searchTimeout);
            categorySearch.searchTimeout = setTimeout(() => {
                loadCategories();
            }, 500);
        });
    }
    
    // Companies management
    const createCompanyBtn = document.getElementById('createCompanyBtn');
    if (createCompanyBtn) {
        createCompanyBtn.addEventListener('click', () => openCompanyModal());
    }
    
    // Warehouses management
    const createWarehouseBtn = document.getElementById('createWarehouseBtn');
    if (createWarehouseBtn) {
        createWarehouseBtn.addEventListener('click', () => openWarehouseModal());
    }
    
    // History filters
    const historyType = document.getElementById('historyType');
    const historyDateFrom = document.getElementById('historyDateFrom');
    const historyDateTo = document.getElementById('historyDateTo');
    if (historyType) {
        historyType.addEventListener('change', () => loadStockHistory(1));
    }
    if (historyDateFrom) {
        historyDateFrom.addEventListener('change', () => loadStockHistory(1));
    }
    if (historyDateTo) {
        historyDateTo.addEventListener('change', () => loadStockHistory(1));
    }
    
    // Users management (admin only)
    const createUserBtn = document.getElementById('createUserBtn');
    const userForm = document.getElementById('userForm');
    const searchUsersBtn = document.getElementById('searchUsersBtn');
    const usersSearch = document.getElementById('usersSearch');
    
    if (createUserBtn) {
        createUserBtn.addEventListener('click', () => openUserModal());
    }
    if (userForm) {
        userForm.addEventListener('submit', saveUser);
    }
    if (searchUsersBtn) {
        searchUsersBtn.addEventListener('click', () => loadUsers(1));
    }
    if (usersSearch) {
        usersSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadUsers(1);
            }
        });
    }
    
    // Sessions - refreshSessionsBtn já foi declarado acima
}

// Inicializar ZXing
function initZXing() {
    try {
        logDebug('Tentando inicializar ZXing...');
        logDebug('ZXing disponível:', typeof ZXing !== 'undefined');
        
        if (typeof ZXing === 'undefined') {
            logWarn('ZXing library não foi carregada - objeto ZXing não encontrado');
            // Tentar novamente após 1 segundo
            setTimeout(initZXing, 1000);
            return;
        }
        
        if (!ZXing.BrowserMultiFormatReader) {
            logWarn('ZXing.BrowserMultiFormatReader não disponível');
            setTimeout(initZXing, 1000);
            return;
        }
        
        codeReader = new ZXing.BrowserMultiFormatReader();
        logDebug('ZXing inicializado com sucesso - codeReader criado');
        
        // Testar se conseguimos obter câmaras
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices()
                .then(devices => {
                    const videoDevices = devices.filter(device => device.kind === 'videoinput');
                    logDebug('Câmaras disponíveis:', videoDevices.length);
                    availableCameras = videoDevices;
                })
                .catch(err => logWarn('Erro ao enumerar câmaras:', err));
        }
        
    } catch (e) {
        logError('Erro ao inicializar ZXing:', e);
        // Tentar novamente após 2 segundos
        setTimeout(initZXing, 2000);
    }
}

// Detectar dispositivo móvel
function detectMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Detectar iOS
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        isMobileDevice = true;
        document.body.classList.add('ios-device');
        return;
    }
    
    // Detectar Android
    if (/android/i.test(userAgent)) {
        isMobileDevice = true;
        document.body.classList.add('android-device');
        return;
    }
    
    // Detectar outros dispositivos móveis
    if (/Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(userAgent)) {
        isMobileDevice = true;
        document.body.classList.add('mobile-device');
        return;
    }
    
    // Detectar por tamanho de ecrã (fallback)
    if (window.innerWidth <= 768) {
        isMobileDevice = true;
        document.body.classList.add('mobile-screen');
    }
    
    logDebug('Dispositivo móvel detectado:', isMobileDevice, 'iOS:', isIOSDevice);
}

// Solicitar permissão de câmara em dispositivos móveis
async function requestCameraPermissionOnMobile() {
    if (!isMobileDevice) return;
    
    try {
        logDebug('Solicitando permissão de câmara para dispositivo móvel...');
        
        // Forçar câmara traseira em mobile
        const constraints = {
            video: {
                facingMode: { exact: 'environment' }, // Forçar câmara traseira
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (exactError) {
            logWarn('Exact environment failed, trying ideal:', exactError);
            // Fallback para ideal se exact falhar
            constraints.video.facingMode = { ideal: 'environment' };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
        
        // Permissão concedida - parar o stream por agora
        cameraPermissionGranted = true;
        stream.getTracks().forEach(track => track.stop());
        
        logDebug('Permissão de câmara concedida');
        
        // Mostrar feedback visual
        showToast('Câmara pronta para digitalização', 'success');
        
        // Atualizar interface para mostrar que a câmara está disponível
        updateCameraUI();
        
    } catch (error) {
        logError('Erro ao solicitar permissão de câmara:', error);
        cameraPermissionGranted = false;
        
        let message = 'Permissão de câmara necessária para digitalização';
        
        if (error.name === 'NotAllowedError') {
            message = 'Permissão de câmara negada. Ative nas definições do navegador.';
        } else if (error.name === 'NotFoundError') {
            message = 'Nenhuma câmara encontrada neste dispositivo.';
        } else if (error.name === 'NotSupportedError') {
            message = 'Câmara não suportada neste navegador.';
        }
        
        showToast(message, 'error');
    }
}

// Atualizar interface da câmara
function updateCameraUI() {
    const startBtn = document.getElementById('startScannerBtn');
    const placeholder = document.getElementById('scannerPlaceholder');
    
    if (cameraPermissionGranted && isMobileDevice) {
        if (startBtn) {
            startBtn.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                Digitalizar Código
            `;
            startBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            startBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        }
        
        if (placeholder) {
            placeholder.innerHTML = `
                <div class="text-center">
                    <svg class="w-16 h-16 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <p class="text-green-600 font-medium">Câmara Pronta</p>
                    <p class="text-gray-500 text-sm">Clique para iniciar digitalização</p>
                </div>
            `;
        }
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validação básica
    if (!username || !password) {
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.textContent = 'Username e password são obrigatórios';
            loginError.classList.remove('hidden');
        }
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // IMPORTANTE: Enviar cookies de sessão
            body: JSON.stringify({ username, password })
        });
        
        // Verificar se a resposta é válida
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Obter texto da resposta antes de fazer parse
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            console.error('Resposta recebida:', responseText.substring(0, 500));
            hideLoading();
            showToast('Erro ao processar resposta do servidor', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            // NOTA: Cookies HttpOnly não são acessíveis via document.cookie
            // Isso é normal e esperado - o cookie será enviado automaticamente nas requisições
            // Verificar se cookies foram recebidos (pode estar vazio se HttpOnly)
            const cookies = document.cookie;
            logDebug('Cookies após login (pode estar vazio se HttpOnly):', cookies);
            
            // Armazenar dados no sessionStorage para referência
            sessionStorage.setItem('username', data.user.username);
            sessionStorage.setItem('userId', data.user.id);
            sessionStorage.setItem('userRole', data.user.role);
            
            // Aguardar um momento para garantir que os cookies foram definidos
            setTimeout(() => {
                showDashboard(data.user.username);
            }, 200);
        } else {
            const loginError = document.getElementById('loginError');
            if (loginError) {
                loginError.textContent = data.message || 'Erro ao fazer login';
                loginError.classList.remove('hidden');
            }
        }
    } catch (error) {
        hideLoading();
        const errorMessage = error.message || 'Erro ao fazer login';
        showToast(errorMessage, 'error');
        logError('Erro no login:', error);
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.textContent = errorMessage;
            loginError.classList.remove('hidden');
        }
    }
}

// Logout
async function handleLogout() {
    try {
        // Chamar API de logout para destruir sessão no servidor
        await fetch(`${API_BASE}/logout.php`, {
            method: 'POST',
            credentials: 'include'
        }).catch(() => {
            // Ignorar erros, continuar com logout local
        });
    } catch (error) {
        // Ignorar erros
    } finally {
        sessionStorage.clear();
        stopScanner();
        showLogin();
    }
}

// Trocar Tab
function switchTab(tabName) {
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
            btn.classList.add('border-blue-500', 'text-blue-600', 'font-medium');
            btn.classList.remove('border-transparent', 'text-gray-500');
        } else {
            btn.classList.remove('active');
            btn.classList.remove('border-blue-500', 'text-blue-600', 'font-medium');
            btn.classList.add('border-transparent', 'text-gray-500');
        }
    });
    
    // Mostrar/ocultar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
}

// Mostrar Modal de Configuração de Contagem
async function showCountSetupModal() {
    document.getElementById('countSetupModal').classList.remove('hidden');
    await loadCompaniesForSetup();
    
    // Event listeners para o modal
    document.getElementById('setupCompanySelect').addEventListener('change', handleCompanyChange);
    document.getElementById('setupWarehouseSelect').addEventListener('change', handleWarehouseChange);
    document.getElementById('setupCreateNewSessionBtn').addEventListener('click', toggleNewSessionForm);
}

// Fechar Modal de Configuração
function closeCountSetupModal() {
    const modal = document.getElementById('countSetupModal');
    if (modal) {
        modal.classList.add('hidden');
        // Limpar seleções
        const companySelect = document.getElementById('setupCompanySelect');
        const warehouseSelect = document.getElementById('setupWarehouseSelect');
        const sessionSelect = document.getElementById('setupSessionSelect');
        const newSessionForm = document.getElementById('setupNewSessionForm');
        const createBtn = document.getElementById('setupCreateNewSessionBtn');
        
        if (companySelect) companySelect.value = '';
        if (warehouseSelect) {
            warehouseSelect.value = '';
            warehouseSelect.disabled = true;
        }
        if (sessionSelect) {
            sessionSelect.value = '';
            sessionSelect.disabled = true;
        }
        if (newSessionForm) newSessionForm.classList.add('hidden');
        if (createBtn) createBtn.classList.add('hidden');
    }
}

// Tornar função global para onclick handlers
window.closeCountSetupModal = closeCountSetupModal;

// Carregar Empresas para o Modal
async function loadCompaniesForSetup() {
    try {
        const response = await fetch(`${API_BASE}/companies.php?active_only=true`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.companies) {
            const select = document.getElementById('setupCompanySelect');
            select.innerHTML = '<option value="">Selecione uma empresa...</option>';
            
            data.companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name + (company.code ? ` (${company.code})` : '');
                select.appendChild(option);
            });
        }
    } catch (error) {
        logError('Erro ao carregar empresas:', error);
        showToast('Erro ao carregar empresas', 'error');
    }
}

// Quando Empresa é Selecionada
async function handleCompanyChange() {
    const companyId = document.getElementById('setupCompanySelect').value;
    const warehouseSelect = document.getElementById('setupWarehouseSelect');
    const sessionSelect = document.getElementById('setupSessionSelect');
    
    if (!companyId) {
        warehouseSelect.innerHTML = '<option value="">Primeiro selecione uma empresa</option>';
        warehouseSelect.disabled = true;
        sessionSelect.innerHTML = '<option value="">Primeiro selecione empresa e armazém</option>';
        sessionSelect.disabled = true;
        return;
    }
    
    // Carregar armazéns da empresa
    try {
        const response = await fetch(`${API_BASE}/warehouses.php?company_id=${companyId}&active_only=true`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.warehouses) {
            warehouseSelect.innerHTML = '<option value="">Selecione um armazém...</option>';
            
            data.warehouses.forEach(warehouse => {
                const option = document.createElement('option');
                option.value = warehouse.id;
                option.textContent = warehouse.name + (warehouse.code ? ` (${warehouse.code})` : '');
                warehouseSelect.appendChild(option);
            });
            
            warehouseSelect.disabled = false;
            warehouseSelect.classList.remove('bg-gray-100');
        } else {
            warehouseSelect.innerHTML = '<option value="">Nenhum armazém encontrado</option>';
        }
        
        // Resetar sessão
        sessionSelect.innerHTML = '<option value="">Primeiro selecione empresa e armazém</option>';
        sessionSelect.disabled = true;
    } catch (error) {
        logError('Erro ao carregar armazéns:', error);
        showToast('Erro ao carregar armazéns', 'error');
    }
}

// Quando Armazém é Selecionado
async function handleWarehouseChange() {
    const companyId = document.getElementById('setupCompanySelect').value;
    const warehouseId = document.getElementById('setupWarehouseSelect').value;
    const sessionSelect = document.getElementById('setupSessionSelect');
    const createBtn = document.getElementById('setupCreateNewSessionBtn');
    
    if (!companyId || !warehouseId) {
        sessionSelect.innerHTML = '<option value="">Primeiro selecione empresa e armazém</option>';
        sessionSelect.disabled = true;
        createBtn.classList.add('hidden');
        return;
    }
    
    // Carregar sessões abertas para a empresa e armazém
    try {
        const response = await fetch(`${API_BASE}/session_count.php`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.sessions) {
            // Filtrar sessões abertas para esta empresa e armazém
            const filteredSessions = data.sessions.filter(s => 
                s.status === 'aberta' && 
                s.company_id == companyId && 
                s.warehouse_id == warehouseId
            );
            
            sessionSelect.innerHTML = '<option value="">Selecione uma sessão...</option>';
            
            filteredSessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = session.name;
                sessionSelect.appendChild(option);
            });
            
            sessionSelect.disabled = false;
            sessionSelect.classList.remove('bg-gray-100');
            createBtn.classList.remove('hidden');
        } else {
            sessionSelect.innerHTML = '<option value="">Nenhuma sessão encontrada</option>';
            createBtn.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro ao carregar sessões:', error);
        showToast('Erro ao carregar sessões', 'error');
    }
}

// Toggle Form de Nova Sessão
function toggleNewSessionForm() {
    const form = document.getElementById('setupNewSessionForm');
    if (form) {
        form.classList.toggle('hidden');
    }
}

// Tornar função global para onclick handlers
window.toggleNewSessionForm = toggleNewSessionForm;

// Confirmar Configuração e Iniciar Scanner
async function confirmCountSetup() {
    const companyId = document.getElementById('setupCompanySelect').value;
    const warehouseId = document.getElementById('setupWarehouseSelect').value;
    const sessionId = document.getElementById('setupSessionSelect').value;
    const newSessionName = document.getElementById('setupSessionName').value;
    const newSessionDesc = document.getElementById('setupSessionDescription').value;
    const isCreatingNewSession = !document.getElementById('setupNewSessionForm').classList.contains('hidden');
    
    // Validações
    if (!companyId || !warehouseId) {
        showToast('Por favor, selecione empresa e armazém', 'error');
        return;
    }
    
    let finalSessionId = sessionId;
    
    // Se está criando nova sessão
    if (isCreatingNewSession && newSessionName) {
        if (!newSessionName.trim()) {
            showToast('Nome da sessão é obrigatório', 'error');
            return;
        }
        
        try {
            showLoading();
            const response = await fetch(`${API_BASE}/session_count.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSessionName,
                    description: newSessionDesc,
                    company_id: parseInt(companyId),
                    warehouse_id: parseInt(warehouseId)
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                finalSessionId = data.session_id;
                showToast('Sessão criada com sucesso', 'success');
            } else {
                showToast(data.message || 'Erro ao criar sessão', 'error');
                hideLoading();
                return;
            }
        } catch (error) {
            logError('Erro ao criar sessão:', error);
            showToast('Erro ao criar sessão', 'error');
            hideLoading();
            return;
        }
    } else if (!sessionId) {
        showToast('Por favor, selecione uma sessão ou crie uma nova', 'error');
        return;
    }
    
    // Definir sessão atual e iniciar scanner
    currentSessionId = finalSessionId;
    
    // Atualizar informação da sessão na UI (sem mostrar o card de detalhes)
    await loadSessionInfo(finalSessionId, false);
    
    hideLoading();
    closeCountSetupModal();
    
    // Iniciar scanner
    await startScanner();
}

// Iniciar Scanner (após configuração)
async function startScanner() {
    logDebug('startScanner called - isMobileDevice:', isMobileDevice, 'isIOSDevice:', isIOSDevice);
    logDebug('codeReader disponível:', !!codeReader);
    logDebug('ZXing disponível:', typeof ZXing !== 'undefined');
    
    if (!codeReader || typeof ZXing === 'undefined') {
        showToast('Scanner não disponível. Certifique-se que a biblioteca ZXing foi carregada.', 'error');
        logError('Scanner não pode ser iniciado - codeReader:', !!codeReader, 'ZXing:', typeof ZXing !== 'undefined');
        return;
    }
    
    try {
        const video = document.getElementById('scannerVideo');
        // iOS/Android: garantir inline e som desligado para autoplay pós-gesto
        if (video) {
            video.setAttribute('playsinline', 'true');
            video.setAttribute('muted', 'true');
            video.muted = true;
        }
        const canvas = document.getElementById('scannerCanvas');
        const placeholder = document.getElementById('scannerPlaceholder');
        
        // Configurações otimizadas para dispositivos móveis
        let constraints = { video: true };
        
        if (isMobileDevice) {
            constraints = {
                video: {
                    facingMode: { exact: 'environment' }, // Forçar câmara traseira
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                }
            };
        }
        
        // Pedir permissão de câmara primeiro (para navegadores modernos)
        try {
            const testStream = await navigator.mediaDevices.getUserMedia(constraints);
            // Em alguns iOS, é necessário manter o stream aberto até iniciar a leitura
            setTimeout(() => {
                try { testStream.getTracks().forEach(track => track.stop()); } catch (_) {}
            }, 250);
        } catch (permError) {
            if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
                showToast('Permissão de câmara negada. Por favor, permita o acesso à câmara nas configurações do navegador.', 'error');
                return;
            } else if (permError.name === 'NotFoundError' || permError.name === 'DevicesNotFoundError') {
                showToast('Nenhuma câmara encontrada. Pode usar o campo de texto para introduzir o código manualmente.', 'warning');
                placeholder.innerHTML = '<p class="text-gray-500">Nenhuma câmara disponível. Use o campo abaixo para introduzir o código manualmente.</p>';
                return;
            }
        }
        
        // Obter lista de câmaras
        let videoInputDevices = [];
        try {
            videoInputDevices = await codeReader.listVideoInputDevices();
        } catch (listError) {
            console.error('Erro ao listar câmaras:', listError);
            // Tentar mesmo assim - algumas versões do ZXing não suportam listVideoInputDevices
            videoInputDevices = [];
        }
        
        // Guardar e preencher seletor
        availableCameras = videoInputDevices || [];
        populateCameraSelect(availableCameras);

        // Preferir traseira se possível
        let selectedDeviceId = null;
        if (availableCameras.length > 0) {
            const rearRegex = /(back|traseira|rear|environment)/i;
            const prefer = availableCameras.find(d => rearRegex.test(d.label || ''));
            selectedDeviceId = (prefer && prefer.deviceId) || availableCameras[0].deviceId;
        }

        if (!selectedDeviceId && videoInputDevices.length === 0) {
            // Tentar usar undefined/null para usar a câmara padrão
            console.warn('Nenhuma câmara listada, tentando usar câmara padrão...');
        }
        
        // Iniciar leitura (usar null/undefined se não houver deviceId para usar câmara padrão)
        currentCameraId = selectedDeviceId || null;

        // Fallback: em iOS alguns browsers não aceitam deviceId. Tentar via constraints diretamente
        const startDecode = async () => {
            if (codeReader.decodeFromConstraints) {
                let constraintsForDecode;
                if (currentCameraId) {
                    constraintsForDecode = { video: { deviceId: { exact: currentCameraId } } };
                } else if (isMobileDevice) {
                    constraintsForDecode = { video: { facingMode: { exact: currentFacingMode } } };
                } else {
                    constraintsForDecode = { video: { facingMode: { ideal: 'environment' } } };
                }
                
                try {
                    return await codeReader.decodeFromConstraints(constraintsForDecode, video, onDecodeCallback);
                } catch (constraintError) {
                    // Fallback se exact falhar - tentar com ideal
                    console.warn('Exact constraint failed, trying ideal:', constraintError);
                    if (isMobileDevice && constraintsForDecode.video.facingMode?.exact) {
                        constraintsForDecode.video.facingMode = { ideal: currentFacingMode };
                        return await codeReader.decodeFromConstraints(constraintsForDecode, video, onDecodeCallback);
                    }
                    throw constraintError;
                }
            }
            return codeReader.decodeFromVideoDevice(currentCameraId, video, onDecodeCallback);
        };

        const onDecodeCallback = (result, err) => {
            if (result) {
                let barcodeText = null;
                try {
                    logDebug('Scanner detectou resultado:', result);
                    
                    if (typeof result.getText === 'function') {
                        barcodeText = result.getText();
                        logDebug('Código extraído via getText():', barcodeText);
                    } else if (result.text) {
                        barcodeText = result.text;
                        logDebug('Código extraído via .text:', barcodeText);
                    } else if (typeof result === 'string') {
                        barcodeText = result;
                        logDebug('Código como string:', barcodeText);
                    }
                    
                    if (barcodeText && barcodeText.trim()) {
                        logDebug('Código de barras detectado:', barcodeText);
                        
                        // Atualizar status
                        const scannerStatusText = document.getElementById('scannerStatusText');
                        if (scannerStatusText) {
                            scannerStatusText.textContent = `Processando código: ${barcodeText.trim()}`;
                        }
                        
                        if (isMobileDevice && navigator.vibrate) navigator.vibrate(200);
                        handleBarcode(barcodeText.trim());
                        stopScanner();
                    } else {
                        logDebug('Resultado vazio ou inválido');
                    }
                } catch (e) {
                    logError('Erro ao processar resultado do scanner:', e);
                }
            }
            
            // Ignorar erros esperados do fluxo de leitura contínua
            if (err) {
                const errorName = err.name || '';
                const errorMessage = err.message || err.toString() || '';
                
                // Erros esperados quando não há código de barras visível
                const isExpectedError = 
                    /NotFound|Checksum|Format/.test(errorName) ||
                    /No MultiFormat Readers/.test(errorMessage) ||
                    /No MultiFormat Readers/.test(errorName);
                
                if (!isExpectedError) {
                    // Apenas logar erros inesperados
                    logDebug('Decode callback error:', err);
                }
            }
        };

        logDebug('Iniciando decodificação...');
        await startDecode();
        logDebug('Decodificação iniciada com sucesso');
        
        // Mostrar o container do scanner e o vídeo
        const scannerContainer = document.getElementById('scanner');
        if (scannerContainer) {
            scannerContainer.classList.remove('hidden');
            logDebug('Scanner container mostrado');
        }
        if (placeholder) {
            placeholder.classList.add('hidden');
            logDebug('Placeholder escondido');
        }
        if (video) {
            video.classList.remove('hidden');
            logDebug('Vídeo mostrado - dimensões:', video.videoWidth, 'x', video.videoHeight);
            
            // Verificar se o vídeo está realmente a reproduzir
            video.addEventListener('loadedmetadata', () => {
                logDebug('Vídeo metadata carregada - dimensões:', video.videoWidth, 'x', video.videoHeight);
            });
            
            video.addEventListener('playing', () => {
                logDebug('Vídeo está a reproduzir');
            });
        }
        
        document.getElementById('startScannerBtn').classList.add('hidden');
        document.getElementById('stopScannerBtn').classList.remove('hidden');
        
        // Mostrar indicador de status
        const scannerStatus = document.getElementById('scannerStatus');
        const scannerStatusText = document.getElementById('scannerStatusText');
        if (scannerStatus) {
            scannerStatus.classList.remove('hidden');
            if (scannerStatusText && currentSessionId) {
                scannerStatusText.textContent = `Sessão ativa - Pronto para escanear códigos`;
            }
        }
        
        logDebug('Scanner iniciado com sucesso');
        const camWrap = document.getElementById('cameraSelectWrapper');
        const camBtn = document.getElementById('switchCameraBtn');
        
        // Mostrar sempre o botão em dispositivos móveis
        if (isMobileDevice) {
            camBtn && camBtn.classList.remove('hidden');
            updateCameraButtonText();
            // Mostrar seletor apenas se houver múltiplas câmaras listadas
            if (availableCameras && availableCameras.length > 1) {
                camWrap && camWrap.classList.remove('hidden');
            } else {
                camWrap && camWrap.classList.add('hidden');
            }
        } else if (availableCameras && availableCameras.length > 1) {
            camWrap && camWrap.classList.remove('hidden');
            camBtn && camBtn.classList.remove('hidden');
            updateCameraButtonText();
        } else {
            camWrap && camWrap.classList.add('hidden');
            camBtn && camBtn.classList.add('hidden');
        }
        
        // Reinício automático se o stream terminar em mobile (capture failure)
        const restartOnEnd = () => {
            try {
                const stream = video.srcObject;
                if (!stream) return;
                stream.getTracks().forEach(track => {
                    track.addEventListener('ended', () => {
                        console.warn('MediaStreamTrack ended — a reiniciar câmara...');
                        stopScanner();
                        setTimeout(() => startScanner(), 200);
                    });
                });
            } catch (_) {}
        };
        restartOnEnd();

        showToast('Scanner iniciado. Aponte a câmara para o código de barras.', 'success');
        
    } catch (error) {
        console.error('Erro ao iniciar scanner:', error);
        
        // Mensagens de erro mais específicas
        let errorMessage = 'Erro ao iniciar scanner';
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permissão de câmara negada. Por favor, permita o acesso à câmara.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Nenhuma câmara encontrada. Use o campo de texto para introduzir o código manualmente.';
        } else if (error.message) {
            errorMessage = `Erro: ${error.message}`;
        }
        
        showToast(errorMessage, 'error');
    }
}

// Parar Scanner
function stopScanner() {
    if (codeReader) {
        codeReader.reset();
    }
    
    const video = document.getElementById('scannerVideo');
    const placeholder = document.getElementById('scannerPlaceholder');
    const scannerContainer = document.getElementById('scanner');
    const startBtn = document.getElementById('startScannerBtn');
    const stopBtn = document.getElementById('stopScannerBtn');
    
    // Ocultar o container do scanner e o vídeo
    if (scannerContainer) scannerContainer.classList.add('hidden');
    if (video) video.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    
    const camWrap = document.getElementById('cameraSelectWrapper');
    const camBtn = document.getElementById('switchCameraBtn');
    const scannerStatus = document.getElementById('scannerStatus');
    
    if (camWrap) camWrap.classList.add('hidden');
    if (camBtn) camBtn.classList.add('hidden');
    if (scannerStatus) scannerStatus.classList.add('hidden');
}

// Preencher seletor de câmaras
function populateCameraSelect(devices) {
    const select = document.getElementById('cameraSelect');
    const wrapper = document.getElementById('cameraSelectWrapper');
    if (!select || !wrapper) return;
    select.innerHTML = '';
    if (!devices || devices.length === 0) {
        wrapper.classList.add('hidden');
        return;
    }
    devices.forEach((d, i) => {
        const opt = document.createElement('option');
        const label = d.label || `Câmara ${i + 1}`;
        opt.value = d.deviceId;
        opt.textContent = label;
        if (currentCameraId && d.deviceId === currentCameraId) opt.selected = true;
        select.appendChild(opt);
    });
}

// Alternar câmara em runtime
async function switchCamera(deviceId, facingModeOverride) {
    try {
        console.log('switchCamera called with deviceId:', deviceId, 'facingMode:', facingModeOverride);
        const video = document.getElementById('scannerVideo');
        if (!codeReader || !video) {
            console.error('CodeReader or video element not available');
            return;
        }
        
        // Parar scanner atual
        codeReader.reset();
        
        // Atualizar estado
        currentCameraId = deviceId || null;
        if (facingModeOverride) {
            currentFacingMode = facingModeOverride;
            console.log('Updated facing mode to:', currentFacingMode);
        }
        
        const callback = (result, err) => {
            if (result) {
                let barcodeText = null;
                try {
                    if (typeof result.getText === 'function') barcodeText = result.getText();
                    else if (result.text) barcodeText = result.text;
                    else if (typeof result === 'string') barcodeText = result;
                    if (barcodeText) {
                        if (isMobileDevice && navigator.vibrate) navigator.vibrate(200);
                        handleBarcode(barcodeText);
                        stopScanner();
                    }
                } catch (_) {}
            }
        };
        
        // Tentar diferentes métodos de inicialização
        let success = false;
        
        // Método 1: decodeFromConstraints (preferido para mobile)
        if (codeReader.decodeFromConstraints && !success) {
            try {
                let constraintsForDecode;
                if (currentCameraId) {
                    constraintsForDecode = { video: { deviceId: { exact: currentCameraId } } };
                } else {
                    constraintsForDecode = { 
                        video: { 
                            facingMode: { exact: currentFacingMode },
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        } 
                    };
                }
                
                console.log('Trying decodeFromConstraints with:', constraintsForDecode);
                await codeReader.decodeFromConstraints(constraintsForDecode, video, callback);
                success = true;
            } catch (constraintError) {
                console.warn('decodeFromConstraints failed:', constraintError);
                
                // Fallback: tentar com ideal em vez de exact
                if (!currentCameraId && currentFacingMode) {
                    try {
                        const fallbackConstraints = { 
                            video: { 
                                facingMode: { ideal: currentFacingMode },
                                width: { ideal: 1280 },
                                height: { ideal: 720 }
                            } 
                        };
                        console.log('Trying fallback constraints:', fallbackConstraints);
                        await codeReader.decodeFromConstraints(fallbackConstraints, video, callback);
                        success = true;
                    } catch (fallbackError) {
                        console.warn('Fallback constraints also failed:', fallbackError);
                    }
                }
            }
        }
        
        // Método 2: decodeFromVideoDevice (fallback)
        if (!success) {
            try {
                console.log('Trying decodeFromVideoDevice with deviceId:', currentCameraId);
                await codeReader.decodeFromVideoDevice(currentCameraId, video, callback);
                success = true;
            } catch (deviceError) {
                console.error('decodeFromVideoDevice failed:', deviceError);
            }
        }
        
        if (success) {
            populateCameraSelect(availableCameras);
            updateCameraButtonText();
            const cameraType = currentFacingMode === 'environment' ? 'traseira' : 'frontal';
            showToast(`Câmara ${cameraType} ativada.`, 'success');
        } else {
            throw new Error('Todos os métodos de inicialização falharam');
        }
        
    } catch (e) {
        console.error('Erro ao alternar câmara:', e);
        showToast('Não foi possível alternar a câmara. Tente reiniciar o scanner.', 'error');
    }
}

// Atualizar texto do botão de câmara
function updateCameraButtonText() {
    const btnText = document.getElementById('switchCameraBtnText');
    if (!btnText) return;
    
    if (isMobileDevice) {
        const currentType = currentFacingMode === 'environment' ? 'Traseira' : 'Frontal';
        const nextType = currentFacingMode === 'environment' ? 'Frontal' : 'Traseira';
        btnText.textContent = `${currentType} → ${nextType}`;
    } else {
        btnText.textContent = 'Trocar Câmara';
    }
}

// Processar Código de Barras
async function handleBarcode(barcode) {
    if (!barcode || !barcode.trim()) return;
    
    try {
        showLoading();
        
        // Validar barcode (não pode estar vazio ou ter caracteres inválidos)
        if (!barcode || typeof barcode !== 'string') {
            throw new Error('Código de barras inválido');
        }
        
        // Buscar item pelo barcode
        const response = await fetch(`${API_BASE}/get_item.php?barcode=${encodeURIComponent(barcode)}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            console.error('Resposta recebida:', responseText.substring(0, 500));
            hideLoading();
            showToast('Erro ao processar resposta do servidor', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success && data.item) {
            const item = data.item;
            
            // Mostrar informações do item
            document.getElementById('itemInfoCard').classList.remove('hidden');
            document.getElementById('scannerItemBarcode').textContent = item.barcode;
            document.getElementById('scannerItemName').textContent = item.name;
            document.getElementById('scannerItemQuantity').textContent = item.quantity || 0;
            
            // Preencher campo manual com o barcode real do item (não o código de referência digitado)
            document.getElementById('itemCardManualBarcode').value = item.barcode;
            
            // Valor padrão da quantidade contada = quantidade atual
            const currentQty = item.quantity || 0;
            document.getElementById('countedQuantity').value = currentQty;
            document.getElementById('countedQuantity').focus();
            document.getElementById('countedQuantity').select();
            
            // Guardar barcode atual para uso no saveCount (usar o barcode real do item)
            currentBarcode = item.barcode;
            currentItemId = item.id;
            
            // Adicionar botão para editar artigo
            const itemInfoCard = document.getElementById('itemInfoCard');
            const editBtn = itemInfoCard.querySelector('#editItemFromScanner');
            if (!editBtn) {
                const editButton = document.createElement('button');
                editButton.id = 'editItemFromScanner';
                editButton.className = 'mt-2 w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-sm';
                editButton.textContent = 'Editar Artigo';
                editButton.onclick = () => {
                    openItemModal(item.id);
                    // Trocar para tab de artigos após abrir modal
                    switchTab('items');
                };
                
                // Encontrar o container dos botões e adicionar o botão de editar
                const saveCountBtn = itemInfoCard.querySelector('button[onclick="saveCount()"]');
                if (saveCountBtn && saveCountBtn.parentNode) {
                    saveCountBtn.parentNode.insertBefore(editButton, saveCountBtn);
                } else {
                    // Fallback: adicionar ao final do itemInfoContent
                    const itemInfoContent = itemInfoCard.querySelector('#itemInfoContent');
                    if (itemInfoContent) {
                        itemInfoContent.appendChild(editButton);
                    }
                }
            }
            
            // Mostrar feedback específico se foi encontrado por código de referência
            if (item.match_type === 'reference' && item.barcode !== barcode) {
                showToast(`Artigo encontrado por código de referência: ${item.name} (${item.barcode})`, 'info');
            } else {
                showToast(`Artigo encontrado: ${item.name}`, 'success');
            }
        } else {
            showToast(data.message || 'Artigo não encontrado', 'error');
            document.getElementById('itemInfoCard').classList.add('hidden');
        }
        
    } catch (error) {
        hideLoading();
        showToast('Erro ao processar código', 'error');
        console.error(error);
    }
}

// Carregar Empresas para o Modal de Criação de Sessão
async function loadCompaniesForSession() {
    const companySelect = document.getElementById('newSessionCompany');
    if (!companySelect) return;
    
    try {
        companySelect.innerHTML = '<option value="">Carregando empresas...</option>';
        const response = await fetch(`${API_BASE}/companies.php?active_only=true`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.companies) {
            companySelect.innerHTML = '<option value="">Selecione uma empresa...</option>';
            
            data.companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name + (company.code ? ` (${company.code})` : '');
                companySelect.appendChild(option);
            });
        } else {
            companySelect.innerHTML = '<option value="">Nenhuma empresa encontrada</option>';
        }
    } catch (error) {
        logError('Erro ao carregar empresas:', error);
        const companySelect = document.getElementById('newSessionCompany');
        if (companySelect) {
            companySelect.innerHTML = '<option value="">Erro ao carregar empresas</option>';
        }
    }
}

// Quando Empresa é Selecionada no Modal de Criação de Sessão
async function handleNewSessionCompanyChange() {
    const companyId = document.getElementById('newSessionCompany').value;
    const warehouseSelect = document.getElementById('newSessionWarehouse');
    
    if (!companyId) {
        if (warehouseSelect) {
            warehouseSelect.innerHTML = '<option value="">Primeiro selecione uma empresa</option>';
            warehouseSelect.disabled = true;
            warehouseSelect.classList.add('bg-gray-100');
        }
        return;
    }
    
    // Carregar armazéns da empresa
    try {
        if (warehouseSelect) {
            warehouseSelect.innerHTML = '<option value="">Carregando armazéns...</option>';
        }
        
        const response = await fetch(`${API_BASE}/warehouses.php?company_id=${companyId}&active_only=true`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.warehouses) {
            if (warehouseSelect) {
                warehouseSelect.innerHTML = '<option value="">Selecione um armazém...</option>';
                
                data.warehouses.forEach(warehouse => {
                    const option = document.createElement('option');
                    option.value = warehouse.id;
                    option.textContent = warehouse.name + (warehouse.code ? ` (${warehouse.code})` : '');
                    warehouseSelect.appendChild(option);
                });
                
                warehouseSelect.disabled = false;
                warehouseSelect.classList.remove('bg-gray-100');
            }
        } else {
            if (warehouseSelect) {
                warehouseSelect.innerHTML = '<option value="">Nenhum armazém encontrado</option>';
            }
        }
    } catch (error) {
        logError('Erro ao carregar armazéns:', error);
        if (warehouseSelect) {
            warehouseSelect.innerHTML = '<option value="">Erro ao carregar armazéns</option>';
        }
    }
}

// Criar Sessão
async function createSession() {
    const nameEl = document.getElementById('newSessionName');
    const descriptionEl = document.getElementById('newSessionDescription');
    const companyEl = document.getElementById('newSessionCompany');
    const warehouseEl = document.getElementById('newSessionWarehouse');
    
    if (!nameEl || !descriptionEl || !companyEl || !warehouseEl) {
        console.error('Elementos do formulário de sessão não encontrados');
        showToast('Erro: Formulário não encontrado', 'error');
        return;
    }
    
    const name = nameEl.value.trim();
    const description = descriptionEl.value.trim();
    const companyId = parseInt(companyEl.value);
    const warehouseId = parseInt(warehouseEl.value);
    
    // Validação básica - só validar se o formulário foi realmente submetido
    if (!companyId || !warehouseId) {
        showToast('Empresa e armazém são obrigatórios', 'error');
        return;
    }
    
    if (!name || name.length === 0) {
        // Focar no campo de nome para indicar o erro
        nameEl.focus();
        showToast('Nome da sessão é obrigatório', 'error');
        return;
    }
    
    if (name.length < 3) {
        showToast('Nome da sessão deve ter pelo menos 3 caracteres', 'error');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/session_count.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                description,
                company_id: companyId,
                warehouse_id: warehouseId
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta do servidor', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            currentSessionId = data.session_id;
            loadSessions();
            const sessionSelect = document.getElementById('sessionSelect');
            const currentSessionInfo = document.getElementById('currentSessionInfo');
            const currentSessionName = document.getElementById('currentSessionName');
            
            if (sessionSelect) sessionSelect.classList.remove('hidden');
            if (currentSessionInfo) currentSessionInfo.classList.remove('hidden');
            if (currentSessionName) currentSessionName.textContent = name;
            
            // Limpar formulário
            if (nameEl) nameEl.value = '';
            if (descriptionEl) descriptionEl.value = '';
            if (companyEl) companyEl.value = '';
            if (warehouseEl) {
                warehouseEl.value = '';
                warehouseEl.disabled = true;
                warehouseEl.classList.add('bg-gray-100');
                warehouseEl.innerHTML = '<option value="">Primeiro selecione uma empresa</option>';
            }
            
            // Fechar modal
            const modal = document.getElementById('createSessionModal');
            if (modal) modal.classList.add('hidden');
            
            showToast('Sessão criada com sucesso');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao criar sessão', 'error');
        console.error(error);
    }
}

// Guardar Contagem
async function saveCount() {
    // Se não houver sessão ativa, tentar encontrar uma sessão aberta ou criar uma automaticamente
    if (!currentSessionId) {
        // Tentar carregar sessões e encontrar uma aberta
        try {
            const sessionsResponse = await fetch(`${API_BASE}/session_count.php`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (sessionsResponse.ok) {
                const sessionsData = await sessionsResponse.json();
                
                if (sessionsData.success && sessionsData.sessions) {
                    // Procurar por uma sessão aberta
                    const openSession = sessionsData.sessions.find(s => s.status === 'aberta');
                    
                    if (openSession) {
                        // Usar a primeira sessão aberta encontrada
                        currentSessionId = openSession.id;
                        document.getElementById('sessionSelect').value = openSession.id;
                        loadSessionInfo(openSession.id, false); // Não mostrar detalhes automaticamente
                        showToast(`Usando sessão: ${openSession.name}`, 'info');
                    } else {
                        // Criar uma sessão automática se não houver nenhuma aberta
                        const autoSessionName = `Inventário ${new Date().toLocaleDateString('pt-PT')}`;
                        const createResponse = await fetch(`${API_BASE}/session_count.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                name: autoSessionName,
                                description: 'Sessão criada automaticamente'
                            }),
                            credentials: 'include'
                        });
                        
                        if (createResponse.ok) {
                            const createData = await createResponse.json();
                            if (createData.success) {
                                currentSessionId = createData.session_id;
                                loadSessions();
                                showToast('Sessão criada automaticamente', 'info');
                            } else {
                                showToast('Selecione ou crie uma sessão primeiro', 'error');
                                return;
                            }
                        } else {
                            showToast('Selecione ou crie uma sessão primeiro', 'error');
                            return;
                        }
                    }
                } else {
                    showToast('Selecione ou crie uma sessão primeiro', 'error');
                    return;
                }
            } else {
                showToast('Selecione ou crie uma sessão primeiro', 'error');
                return;
            }
        } catch (error) {
            console.error('Erro ao verificar sessões:', error);
            showToast('Selecione ou crie uma sessão primeiro', 'error');
            return;
        }
    }
    
    const barcode = currentBarcode || document.getElementById('itemCardManualBarcode').value;
    const countedQuantity = document.getElementById('countedQuantity').value;
    
    // Validações
    const barcodeValidation = validateBarcode(barcode);
    if (!barcodeValidation.valid) {
        showToast(barcodeValidation.message, 'error');
        return;
    }
    
    const quantityValidation = validateQuantity(countedQuantity);
    if (!quantityValidation.valid) {
        showToast(quantityValidation.message, 'error');
        return;
    }
    
    const qty = quantityValidation.value;
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/session_count.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                barcode: barcode,
                counted_quantity: qty
            }),
            credentials: 'include' // Enviar cookies de sessão
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta do servidor', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            showToast('Contagem guardada com sucesso', 'success');
            
            // Atualizar informações da sessão (sem mostrar detalhes)
            if (currentSessionId) {
                loadSessionInfo(currentSessionId, false);
            }
            
            // Fechar o card de informações do item após guardar
            document.getElementById('itemInfoCard').classList.add('hidden');
            
            // Limpar dados globais
            currentBarcode = null;
            currentItemId = null;
            
            // Limpar campos
            document.getElementById('countedQuantity').value = 0;
            document.getElementById('itemCardManualBarcode').value = '';
            
            // Reativar o scanner automaticamente para continuar escaneando
            setTimeout(async () => {
                try {
                    await startScanner();
                    showToast('Scanner reativado - pronto para o próximo código!', 'info');
                } catch (error) {
                    logError('Erro ao reativar scanner:', error);
                    showToast('Erro ao reativar scanner. Use entrada manual ou reinicie.', 'warning');
                }
            }, 500); // Pequeno delay para garantir que o card foi fechado
        } else {
            showToast(data.message || 'Erro ao guardar contagem', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao guardar contagem', 'error');
        console.error(error);
    }
}

// Carregar Sessões
async function loadSessions() {
    try {
        const response = await fetch(`${API_BASE}/session_count.php`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            showToast('Erro ao carregar sessões', 'error');
            return;
        }
        
        if (data.success) {
            const sessionsList = document.getElementById('sessionsList');
            const sessionSelect = document.getElementById('sessionSelect');
            
            sessionsList.innerHTML = '';
            sessionSelect.innerHTML = '<option value="">Selecione uma sessão...</option>';
            
            data.sessions.forEach(session => {
                // Lista de sessões
                const sessionCard = document.createElement('div');
                sessionCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
                sessionCard.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold">${session.name}</h4>
                            <p class="text-sm text-gray-600">${session.description || ''}</p>
                            <p class="text-xs text-gray-500 mt-2">
                                Criado por: ${session.created_by} | 
                                Status: ${session.status} | 
                                Contagens: ${session.total_counts || 0}
                            </p>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="loadSessionInfo(${session.id}, true)" 
                                    class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                                Ver
                            </button>
                            <a href="${API_BASE}/export_session.php?id=${session.id}&format=csv" 
                               class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                                Exportar
                            </a>
                        </div>
                    </div>
                `;
                sessionsList.appendChild(sessionCard);
                
                // Select de sessões
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = session.name;
                if (session.status === 'aberta') {
                    option.textContent += ' (Aberta)';
                }
                sessionSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar sessões:', error);
    }
}

// Carregar Info da Sessão
async function loadSessionInfo(sessionId, showDetails = false) {
    currentSessionId = sessionId;
    
    try {
        const response = await fetch(`${API_BASE}/session_count.php?id=${sessionId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            showToast('Erro ao carregar sessão', 'error');
            return;
        }
        
        if (data.success) {
            const session = data.session;
            
            // Atualizar informações na área do scanner
            const currentSessionInfo = document.getElementById('currentSessionInfo');
            if (currentSessionInfo) {
                currentSessionInfo.classList.remove('hidden');
                document.getElementById('currentSessionName').textContent = session.name;
                document.getElementById('sessionCount').textContent = session.total_counts || 0;
            }
            
            const sessionSelect = document.getElementById('sessionSelect');
            if (sessionSelect) {
                sessionSelect.value = sessionId;
            }
            
            // Mostrar detalhes da sessão apenas se solicitado
            if (showDetails) {
                setTimeout(() => {
                    showSessionDetails(session, session.counts || []);
                }, 100);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar sessão:', error);
        showToast('Erro ao carregar sessão', 'error');
    }
}

// Mostrar detalhes da sessão
function showSessionDetails(session, counts) {
    const detailsCard = document.getElementById('sessionDetailsCard');
    const detailsContent = document.getElementById('sessionDetailsContent');
    
    if (!detailsCard || !detailsContent) return;
    
    // Calcular estatísticas
    const totalCounts = counts.length;
    const discrepancies = counts.filter(count => count.difference !== 0).length;
    const totalItems = counts.reduce((sum, count) => sum + parseInt(count.counted_quantity || 0), 0);
    
    detailsContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Informações da Sessão -->
            <div>
                <h4 class="text-lg font-semibold mb-3">Informações Gerais</h4>
                <div class="space-y-2">
                    <p><strong>Nome:</strong> ${session.name}</p>
                    <p><strong>Descrição:</strong> ${session.description || 'N/A'}</p>
                    <p><strong>Empresa:</strong> ${session.company_name || 'N/A'} ${session.company_code ? `(${session.company_code})` : ''}</p>
                    <p><strong>Armazém:</strong> ${session.warehouse_name || 'N/A'} ${session.warehouse_code ? `(${session.warehouse_code})` : ''}</p>
                    <p><strong>Criado por:</strong> ${session.created_by}</p>
                    <p><strong>Status:</strong> <span class="px-2 py-1 rounded text-sm ${session.status === 'aberta' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${session.status}</span></p>
                    <p><strong>Iniciado em:</strong> ${new Date(session.started_at).toLocaleString('pt-PT')}</p>
                    ${session.finished_at ? `<p><strong>Finalizado em:</strong> ${new Date(session.finished_at).toLocaleString('pt-PT')}</p>` : ''}
                </div>
            </div>
            
            <!-- Estatísticas -->
            <div>
                <h4 class="text-lg font-semibold mb-3">Estatísticas</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <p class="text-2xl font-bold text-blue-600">${totalCounts}</p>
                        <p class="text-sm text-gray-600">Total de Contagens</p>
                    </div>
                    <div class="bg-yellow-50 p-4 rounded-lg">
                        <p class="text-2xl font-bold text-yellow-600">${discrepancies}</p>
                        <p class="text-sm text-gray-600">Discrepâncias</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg">
                        <p class="text-2xl font-bold text-green-600">${totalItems}</p>
                        <p class="text-sm text-gray-600">Itens Contados</p>
                    </div>
                    <div class="bg-purple-50 p-4 rounded-lg">
                        <p class="text-2xl font-bold text-purple-600">${totalCounts > 0 ? Math.round((discrepancies / totalCounts) * 100) : 0}%</p>
                        <p class="text-sm text-gray-600">Taxa de Discrepância</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Lista de Contagens -->
        ${counts.length > 0 ? `
            <div class="mt-6">
                <h4 class="text-lg font-semibold mb-3">Contagens Realizadas</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Artigo</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código de Barras</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qtd. Sistema</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qtd. Contada</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Diferença</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                ${session.status === 'aberta' ? '<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>' : ''}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${counts.slice(0, 20).map(count => `
                                <tr class="${count.difference !== 0 ? 'bg-yellow-50' : ''}">
                                    <td class="px-4 py-2 text-sm">${count.item_name || 'N/A'}</td>
                                    <td class="px-4 py-2 text-sm font-mono">${count.barcode}</td>
                                    <td class="px-4 py-2 text-sm">${count.expected_quantity || count.system_quantity || 0}</td>
                                    <td class="px-4 py-2 text-sm">${count.counted_quantity}</td>
                                    <td class="px-4 py-2 text-sm ${count.difference > 0 ? 'text-green-600' : count.difference < 0 ? 'text-red-600' : ''}">${count.difference > 0 ? '+' : ''}${count.difference}</td>
                                    <td class="px-4 py-2 text-sm">${new Date(count.counted_at).toLocaleString('pt-PT')}</td>
                                    ${session.status === 'aberta' ? `
                                        <td class="px-4 py-2 text-sm">
                                            <button onclick="editCount(${count.id}, ${count.counted_quantity}, '${count.notes || ''}')" 
                                                    class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
                                                ✏️ Editar
                                            </button>
                                        </td>
                                    ` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${counts.length > 20 ? `<p class="text-sm text-gray-500 mt-2">Mostrando 20 de ${counts.length} contagens. <a href="${API_BASE}/export_session.php?id=${session.id}&format=csv" class="text-blue-600 hover:underline">Exportar todas</a></p>` : ''}
                </div>
            </div>
        ` : '<div class="mt-6 text-center text-gray-500">Nenhuma contagem realizada ainda.</div>'}
        
        <!-- Ações -->
        <div class="mt-6 flex space-x-3 flex-wrap gap-2">
            ${session.status === 'aberta' ? `
                <button onclick="closeSession(${session.id})" 
                        class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                    🔒 Fechar Sessão
                </button>
            ` : ''}
            <a href="${API_BASE}/export_session.php?id=${session.id}&format=csv" 
               class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                📥 Exportar CSV
            </a>
            <a href="${API_BASE}/export_session.php?id=${session.id}&format=json" 
               class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                📥 Exportar JSON
            </a>
        </div>
    `;
    
    detailsCard.classList.remove('hidden');
}

// Fechar detalhes da sessão
function closeSessionDetails() {
    const detailsCard = document.getElementById('sessionDetailsCard');
    if (detailsCard) {
        detailsCard.classList.add('hidden');
    }
}

// Fechar sessão de inventário
async function closeSession(sessionId) {
    if (!sessionId) {
        showToast('ID da sessão não fornecido', 'error');
        return;
    }

    // Confirmar ação
    if (!confirm('Tem certeza que deseja fechar esta sessão? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/session_count.php`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                session_id: sessionId,
                status: 'fechada'
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Sessão fechada com sucesso!', 'success');
            
            // Recarregar detalhes da sessão para atualizar o status
            await loadSessionInfo(sessionId, true);
            
            // Recarregar lista de sessões
            await loadSessions();
            
            // Se a sessão fechada era a sessão atual do scanner, limpar seleção
            if (currentSessionId === sessionId) {
                currentSessionId = null;
                const sessionSelect = document.getElementById('sessionSelect');
                if (sessionSelect) {
                    sessionSelect.value = '';
                }
            }
        } else {
            showToast(data.message || 'Erro ao fechar sessão', 'error');
        }
    } catch (error) {
        console.error('Erro ao fechar sessão:', error);
        showToast('Erro ao fechar sessão. Tente novamente.', 'error');
    }
}

// Tornar função global para uso em onclick
window.closeSession = closeSession;

// Editar contagem
function editCount(countId, countedQuantity, notes) {
    const modal = document.getElementById('editCountModal');
    const countIdInput = document.getElementById('editCountId');
    const quantityInput = document.getElementById('editCountedQuantity');
    const notesInput = document.getElementById('editCountNotes');
    
    if (!modal || !countIdInput || !quantityInput || !notesInput) {
        showToast('Erro ao abrir modal de edição', 'error');
        return;
    }
    
    // Preencher campos
    countIdInput.value = countId;
    quantityInput.value = countedQuantity;
    notesInput.value = notes || '';
    
    // Mostrar modal
    modal.classList.remove('hidden');
}

// Fechar modal de editar contagem
function closeEditCountModal() {
    const modal = document.getElementById('editCountModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Atualizar contagem
async function updateCount(event) {
    event.preventDefault();
    
    const countId = document.getElementById('editCountId').value;
    const countedQuantity = parseInt(document.getElementById('editCountedQuantity').value);
    const notes = document.getElementById('editCountNotes').value;
    
    if (!countId || countedQuantity < 0) {
        showToast('Dados inválidos', 'error');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/session_count.php`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                count_id: countId,
                counted_quantity: countedQuantity,
                notes: notes
            })
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            showToast('Contagem atualizada com sucesso!', 'success');
            closeEditCountModal();
            
            // Recarregar detalhes da sessão para atualizar a lista
            const sessionDetailsCard = document.getElementById('sessionDetailsCard');
            if (sessionDetailsCard && !sessionDetailsCard.classList.contains('hidden')) {
                // Se a card de detalhes estiver aberta, recarregar
                const sessionId = currentSessionId;
                if (sessionId) {
                    await loadSessionInfo(sessionId, true);
                }
            }
        } else {
            showToast(data.message || 'Erro ao atualizar contagem', 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Erro ao atualizar contagem:', error);
        showToast('Erro ao atualizar contagem. Tente novamente.', 'error');
    }
}

// Tornar funções globais para uso em onclick
window.editCount = editCount;
window.closeEditCountModal = closeEditCountModal;
window.updateCount = updateCount;

// Fazer Upload de Ficheiro
async function uploadFile() {
    const fileInput = document.getElementById('importFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const file = fileInput.files[0];
    
    // Validação
    const validation = validateImportFile(file);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }
    
    if (uploadBtn) uploadBtn.disabled = true;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/items_import.php`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            console.error('Resposta recebida:', responseText.substring(0, 500));
            hideLoading();
            showToast('Erro ao processar resposta do servidor', 'error');
            if (uploadBtn) uploadBtn.disabled = false;
            return;
        }
        
        if (!response.ok) {
            hideLoading();
            showToast(data.message || `Erro no upload (${response.status})`, 'error');
            if (uploadBtn) uploadBtn.disabled = false;
            return;
        }
        
        hideLoading();
        
        const resultDiv = document.getElementById('importResults');
        if (resultDiv) {
            resultDiv.classList.remove('hidden');
        }
        
        if (data.success) {
            if (resultDiv) {
                resultDiv.className = 'p-4 bg-green-50 rounded-lg text-green-800';
                const errorsHtml = (data.errors && data.errors.length)
                    ? `<div class="mt-2 text-red-700"><p class="font-semibold mb-1">Ocorreram alguns avisos/erros:</p><ul class="list-disc ml-5 text-sm">${data.errors.slice(0,10).map(e => `<li>${e}</li>`).join('')}</ul>${data.errors.length>10?`<p class=\"text-xs mt-1\">(+${data.errors.length-10} mais)</p>`:''}</div>`
                    : '';
                resultDiv.innerHTML = `
                    <p class="font-bold">Importação concluída com sucesso!</p>
                    <p class="text-sm mt-2">
                        Importados: ${data.imported || 0} | 
                        Atualizados: ${data.updated || 0}
                    </p>
                    ${errorsHtml}
                `;
            }
            fileInput.value = '';
            if (uploadBtn) uploadBtn.disabled = true;
        } else {
            if (resultDiv) {
                resultDiv.className = 'p-4 bg-red-50 rounded-lg text-red-800';
                resultDiv.innerHTML = `<p>${data.message}</p>`;
            }
            if (uploadBtn) uploadBtn.disabled = false;
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao fazer upload', 'error');
        console.error(error);
        if (uploadBtn) uploadBtn.disabled = false;
    }
}

// Utilitários
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }
    
    toastMessage.textContent = message;
    
    // Definir cor baseado no tipo
    let bgColor = 'bg-green-500'; // padrão: success
    if (type === 'error') {
        bgColor = 'bg-red-500';
    } else if (type === 'warning') {
        bgColor = 'bg-yellow-500';
    } else if (type === 'info') {
        bgColor = 'bg-blue-500';
    }
    
    toast.className = `fixed top-4 right-4 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${bgColor}`;
    toast.classList.remove('hidden');
    
    // Auto-hide após 3-5 segundos (mais tempo para erros)
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

// ==========================================
// Dashboard Functions
// ==========================================

// Carregar Dashboard
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/stats.php`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            return;
        }
        
        if (data.success && data.stats) {
            const stats = data.stats;
            
            // Atualizar cards
            document.getElementById('statTotalItems').textContent = stats.total_items || 0;
            document.getElementById('statLowStock').textContent = stats.low_stock_items || 0;
            document.getElementById('statOpenSessions').textContent = stats.open_sessions || 0;
            
            // Formatar valor do inventário em CVE (Escudos Cabo-verdianos)
            const value = stats.total_inventory_value || 0;
            document.getElementById('statInventoryValue').textContent = 
                new Intl.NumberFormat('pt-CV', { style: 'currency', currency: 'CVE' }).format(value);
            
            // Lista de stock baixo
            const lowStockList = document.getElementById('lowStockList');
            if (lowStockList) {
                if (stats.low_stock_list && stats.low_stock_list.length > 0) {
                    lowStockList.innerHTML = stats.low_stock_list.map(item => `
                        <div class="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                            <div>
                                <p class="font-semibold">${item.name}</p>
                                <p class="text-sm text-gray-600">Código: ${item.barcode} | Stock: ${item.quantity}/${item.min_quantity}</p>
                            </div>
                            <span class="text-red-600 font-bold">Falta: ${item.shortage}</span>
                        </div>
                    `).join('');
                } else {
                    lowStockList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum artigo com stock baixo</p>';
                }
            }
            
            // Top categorias
            const topCategoriesList = document.getElementById('topCategoriesList');
            if (topCategoriesList) {
                if (stats.top_categories && stats.top_categories.length > 0) {
                    topCategoriesList.innerHTML = stats.top_categories.map(cat => `
                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p class="font-semibold">${cat.name}</p>
                            </div>
                            <span class="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-semibold">
                                ${cat.items_count} artigos
                            </span>
                        </div>
                    `).join('');
                } else {
                    topCategoriesList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma categoria disponível</p>';
                }
            }
            
            // Banner de alerta de stock baixo
            const lowStockBanner = document.getElementById('lowStockBanner');
            if (lowStockBanner) {
                if ((stats.low_stock_items || 0) > 0) {
                    lowStockBanner.classList.remove('hidden');
                } else {
                    lowStockBanner.classList.add('hidden');
                }
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// ==========================================
// Items Management Functions
// ==========================================

// Variáveis de paginação e pesquisa (declaradas mais abaixo)

// Carregar Artigos
async function loadItems(page = 1, search = '') {
    try {
        showLoading();
        currentItemsPage = page;
        const itemsSearchEl = document.getElementById('itemsSearch');
        currentItemsSearch = search || (itemsSearchEl ? itemsSearchEl.value : '');
        
        const params = new URLSearchParams({
            page: page,
            limit: 20
        });
        
        if (currentItemsSearch) {
            params.append('search', currentItemsSearch);
        }
        const lowOnly = document.getElementById('itemsLowStockOnly');
        if (lowOnly && lowOnly.checked) {
            params.append('low_stock', 'true');
        }
        
        const response = await fetch(`${API_BASE}/items.php?${params.toString()}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao carregar artigos', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            const itemsList = document.getElementById('itemsList');
            itemsList.innerHTML = '';
            
            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    const itemCard = document.createElement('div');
                    const isLow = (parseInt(item.quantity) || 0) <= (parseInt(item.min_quantity) || 0);
                    itemCard.className = `rounded-lg p-4 border shadow-sm ${isLow ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`;
                    itemCard.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-center space-x-3">
                                    <h4 class="font-bold text-lg ${isLow ? 'text-red-700' : ''}">${item.name}</h4>
                                    <span class="text-xs bg-gray-200 px-2 py-1 rounded">${item.barcode}</span>
                                    ${isLow ? '<span class="text-xs bg-red-500 text-white px-2 py-1 rounded">Stock Baixo</span>' : ''}
                                </div>
                                <p class="text-sm text-gray-600 mt-1">${item.description || 'Sem descrição'}</p>
                                <div class="mt-2 flex space-x-4 text-sm">
                                    <span><strong>Categoria:</strong> ${item.category_name || 'Sem categoria'}</span>
                                    <span><strong>Quantidade:</strong> ${item.quantity}</span>
                                    <span><strong>Preço:</strong> ${new Intl.NumberFormat('pt-CV', { style: 'currency', currency: 'CVE' }).format(item.unit_price || 0)}</span>
                                </div>
                                ${item.location ? `<p class="text-xs text-gray-500 mt-1"><strong>Local:</strong> ${item.location}</p>` : ''}
                            </div>
                            <div class="flex space-x-2 ml-4">
                                <button onclick="editItem(${item.id})" 
                                        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                                    Editar
                                </button>
                                <button onclick="deleteItem(${item.id})" 
                                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    `;
                    itemsList.appendChild(itemCard);
                });
                
                // Paginação
                if (data.pagination && data.pagination.pages > 1) {
                    const paginationDiv = document.getElementById('itemsPagination');
                    paginationDiv.innerHTML = '';
                    
                    for (let i = 1; i <= data.pagination.pages; i++) {
                        const btn = document.createElement('button');
                        btn.className = `px-4 py-2 rounded-lg ${i === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`;
                        btn.textContent = i;
                        btn.onclick = () => loadItems(i);
                        paginationDiv.appendChild(btn);
                    }
                } else {
                    document.getElementById('itemsPagination').innerHTML = '';
                }
            } else {
                itemsList.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum artigo encontrado</p>';
            }
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao carregar artigos', 'error');
        console.error(error);
    }
}

// ==========================================
// Companies Management Functions
// ==========================================

async function loadCompanies() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/companies.php?active_only=false`, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        hideLoading();
        if (data.success) {
            const list = document.getElementById('companiesList');
            list.innerHTML = '';
            (data.companies || []).forEach(c => {
                const card = document.createElement('div');
                card.className = `rounded-2xl p-4 shadow-md border ${c.is_active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-80'}`;
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-lg font-bold">${c.name}</h4>
                            <p class="text-sm text-gray-600">${c.code || ''}</p>
                            ${c.address ? `<p class=\"text-xs text-gray-500 mt-1\">${c.address}</p>` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button class="px-3 py-1 rounded bg-blue-600 text-white text-sm" onclick="openCompanyModal(${c.id})">Editar</button>
                            <button class="px-3 py-1 rounded bg-red-600 text-white text-sm" onclick="deleteCompany(${c.id})">Eliminar</button>
                        </div>
                    </div>`;
                list.appendChild(card);
            });
        }
    } catch (e) {
        hideLoading();
        console.error(e);
        showToast('Erro ao carregar empresas', 'error');
    }
}

function openCompanyModal(id = null) {
    document.getElementById('companyForm').reset();
    document.getElementById('companyId').value = '';
    document.getElementById('companyModalTitle').textContent = id ? 'Editar Empresa' : 'Nova Empresa';
    const modal = document.getElementById('companyModal');
    modal.classList.remove('hidden');
    if (id) {
        // carregar empresa
        fetch(`${API_BASE}/companies.php?id=${id}`, { credentials: 'include' })
            .then(r => r.text()).then(t => { try { return JSON.parse(t); } catch { throw new Error('parse'); } })
            .then(data => {
                if (data.success && data.company) {
                    const c = data.company;
                    document.getElementById('companyId').value = c.id;
                    document.getElementById('companyName').value = c.name || '';
                    document.getElementById('companyCode').value = c.code || '';
                    document.getElementById('companyAddress').value = c.address || '';
                    document.getElementById('companyPhone').value = c.phone || '';
                    document.getElementById('companyEmail').value = c.email || '';
                    document.getElementById('companyTaxId').value = c.tax_id || '';
                    document.getElementById('companyActive').checked = !!c.is_active;
                }
            }).catch(() => showToast('Erro ao carregar empresa', 'error'));
    }
}

function closeCompanyModal() {
    document.getElementById('companyModal').classList.add('hidden');
}

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'companyForm') {
        e.preventDefault();
        saveCompany();
    }
});

async function saveCompany() {
    const id = document.getElementById('companyId').value;
    const payload = {
        name: document.getElementById('companyName').value,
        code: document.getElementById('companyCode').value,
        address: document.getElementById('companyAddress').value,
        phone: document.getElementById('companyPhone').value,
        email: document.getElementById('companyEmail').value,
        tax_id: document.getElementById('companyTaxId').value,
        is_active: document.getElementById('companyActive').checked
    };
    if (id) payload.id = parseInt(id);
    try {
        showLoading();
        const method = id ? 'PUT' : 'POST';
        const resp = await fetch(`${API_BASE}/companies.php`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        hideLoading();
        if (data.success) {
            showToast('Empresa guardada com sucesso');
            closeCompanyModal();
            loadCompanies();
        } else {
            showToast(data.message || 'Erro ao guardar empresa', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('Erro ao guardar empresa', 'error');
    }
}

async function deleteCompany(id) {
    if (!confirm('Eliminar esta empresa?')) return;
    try {
        showLoading();
        const resp = await fetch(`${API_BASE}/companies.php?id=${id}`, { 
            method: 'DELETE',
            credentials: 'include'
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        hideLoading();
        if (data.success) { showToast('Empresa eliminada'); loadCompanies(); } else { showToast(data.message || 'Erro', 'error'); }
    } catch {
        hideLoading();
        showToast('Erro ao eliminar empresa', 'error');
    }
}

// ==========================================
// Warehouses Management Functions
// ==========================================

async function loadWarehouses() {
    try {
        showLoading();
        const resp = await fetch(`${API_BASE}/warehouses.php`, { credentials: 'include' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        hideLoading();
        if (data.success) {
            const list = document.getElementById('warehousesList');
            list.innerHTML = '';
            (data.warehouses || []).forEach(w => {
                const card = document.createElement('div');
                card.className = `rounded-2xl p-4 shadow-md border ${w.is_active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-80'}`;
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-lg font-bold">${w.name}</h4>
                            <p class="text-sm text-gray-600">${w.company_name || ''} ${w.code ? '• ' + w.code : ''}</p>
                            ${w.location ? `<p class=\"text-xs text-gray-500 mt-1\">${w.location}</p>` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button class="px-3 py-1 rounded bg-blue-600 text-white text-sm" onclick="openWarehouseModal(${w.id})">Editar</button>
                            <button class="px-3 py-1 rounded bg-red-600 text-white text-sm" onclick="deleteWarehouse(${w.id})">Eliminar</button>
                        </div>
                    </div>`;
                list.appendChild(card);
            });
        }
    } catch (e) {
        hideLoading();
        showToast('Erro ao carregar armazéns', 'error');
    }
}

async function populateCompaniesSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    const resp = await fetch(`${API_BASE}/companies.php?active_only=true`, { credentials: 'include' });
    if (!resp.ok) return;
    const data = await resp.json();
    const opts = (data.companies || []).map(c => `<option value="${c.id}">${c.name}${c.code ? ' (' + c.code + ')' : ''}</option>`).join('');
    select.innerHTML = opts;
}

function openWarehouseModal(id = null) {
    document.getElementById('warehouseForm').reset();
    document.getElementById('warehouseId').value = '';
    document.getElementById('warehouseModalTitle').textContent = id ? 'Editar Armazém' : 'Novo Armazém';
    populateCompaniesSelect('warehouseCompany');
    document.getElementById('warehouseModal').classList.remove('hidden');
    if (id) {
        fetch(`${API_BASE}/warehouses.php?id=${id}`, { credentials: 'include' })
            .then(r => r.text()).then(t => { try { return JSON.parse(t); } catch { throw new Error('parse'); } })
            .then(data => {
                if (data.success && data.warehouse) {
                    const w = data.warehouse;
                    document.getElementById('warehouseId').value = w.id;
                    document.getElementById('warehouseCompany').value = w.company_id;
                    document.getElementById('warehouseName').value = w.name || '';
                    document.getElementById('warehouseCode').value = w.code || '';
                    document.getElementById('warehouseAddress').value = w.address || '';
                    document.getElementById('warehouseLocation').value = w.location || '';
                    document.getElementById('warehouseActive').checked = !!w.is_active;
                }
            }).catch(() => showToast('Erro ao carregar armazém', 'error'));
    }
}

function closeWarehouseModal() {
    document.getElementById('warehouseModal').classList.add('hidden');
}

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'warehouseForm') {
        e.preventDefault();
        saveWarehouse();
    }
});

async function saveWarehouse() {
    const id = document.getElementById('warehouseId').value;
    const payload = {
        company_id: parseInt(document.getElementById('warehouseCompany').value),
        name: document.getElementById('warehouseName').value,
        code: document.getElementById('warehouseCode').value,
        address: document.getElementById('warehouseAddress').value,
        location: document.getElementById('warehouseLocation').value,
        is_active: document.getElementById('warehouseActive').checked
    };
    if (id) payload.id = parseInt(id);
    try {
        showLoading();
        const method = id ? 'PUT' : 'POST';
        const resp = await fetch(`${API_BASE}/warehouses.php`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        hideLoading();
        if (data.success) {
            showToast('Armazém guardado com sucesso');
            closeWarehouseModal();
            loadWarehouses();
        } else {
            showToast(data.message || 'Erro ao guardar armazém', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('Erro ao guardar armazém', 'error');
    }
}

async function deleteWarehouse(id) {
    if (!confirm('Eliminar este armazém?')) return;
    try {
        showLoading();
        const resp = await fetch(`${API_BASE}/warehouses.php?id=${id}`, { 
            method: 'DELETE',
            credentials: 'include'
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        hideLoading();
        if (data.success) { showToast('Armazém eliminado'); loadWarehouses(); } else { showToast(data.message || 'Erro', 'error'); }
    } catch {
        hideLoading();
        showToast('Erro ao eliminar armazém', 'error');
    }
}

// Abrir Modal de Artigo
async function openItemModal(itemId = null) {
    const modal = document.getElementById('itemModal');
    const form = document.getElementById('itemForm');
    const modalTitle = document.getElementById('itemModalTitle');
    
    // Limpar formulário
    form.reset();
    document.getElementById('itemId').value = '';
    
    // Carregar categorias no select
    await loadCategoriesForSelect();
    
    if (itemId) {
        // Editar artigo existente
        modalTitle.textContent = 'Editar Artigo';
        try {
            showLoading();
            const response = await fetch(`${API_BASE}/items.php?id=${itemId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            let data;
            
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Erro ao fazer parse do JSON:', parseError);
                hideLoading();
                showToast('Erro ao carregar artigo', 'error');
                return;
            }
            
            hideLoading();
            
            if (data.success && data.item) {
                const item = data.item;
                document.getElementById('itemId').value = item.id;
                document.getElementById('itemBarcode').value = item.barcode;
                document.getElementById('itemName').value = item.name;
                document.getElementById('itemDescription').value = item.description || '';
                document.getElementById('itemCategory').value = item.category_id || '';
                document.getElementById('itemQuantity').value = item.quantity || 0;
                document.getElementById('itemMinQuantity').value = item.min_quantity || 0;
                document.getElementById('itemPrice').value = item.unit_price || 0;
                document.getElementById('itemLocation').value = item.location || '';
                document.getElementById('itemSupplier').value = item.supplier || '';
            }
        } catch (error) {
            hideLoading();
            showToast('Erro ao carregar artigo', 'error');
            console.error(error);
        }
    } else {
        // Novo artigo
        modalTitle.textContent = 'Novo Artigo';
    }
    
    modal.classList.remove('hidden');
}

// Fechar Modal de Artigo
function closeItemModal() {
    document.getElementById('itemModal').classList.add('hidden');
    document.getElementById('itemForm').reset();
}

// Fechar Card de Informações do Item
function closeItemInfo() {
    const itemInfoCard = document.getElementById('itemInfoCard');
    if (itemInfoCard) {
        itemInfoCard.classList.add('hidden');
    }
    
    // Limpar dados
    currentBarcode = null;
    currentItemId = null;
    
    // Limpar campos
    const manualBarcodeField = document.getElementById('itemCardManualBarcode');
    const countedQuantityField = document.getElementById('countedQuantity');
    if (manualBarcodeField) manualBarcodeField.value = '';
    if (countedQuantityField) countedQuantityField.value = '0';
}

// Guardar Artigo
async function saveItem(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('itemId').value;
    const barcode = document.getElementById('itemBarcode').value;
    const name = document.getElementById('itemName').value;
    
    // Validações
    const barcodeValidation = validateBarcode(barcode);
    if (!barcodeValidation.valid) {
        showToast(barcodeValidation.message, 'error');
        return;
    }
    
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
        showToast(nameValidation.message, 'error');
        return;
    }
    
    const itemData = {
        barcode: barcode,
        name: name,
        description: document.getElementById('itemDescription').value,
        category_id: document.getElementById('itemCategory').value || null,
        quantity: parseInt(document.getElementById('itemQuantity').value) || 0,
        min_quantity: parseInt(document.getElementById('itemMinQuantity').value) || 0,
        unit_price: parseFloat(document.getElementById('itemPrice').value) || 0,
        location: document.getElementById('itemLocation').value,
        supplier: document.getElementById('itemSupplier').value
    };
    
    if (itemId) {
        itemData.id = parseInt(itemId);
    }
    
    try {
        showLoading();
        const method = itemId ? 'PUT' : 'POST';
        
        const response = await fetch(`${API_BASE}/items.php`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            showToast(itemId ? 'Artigo atualizado com sucesso' : 'Artigo criado com sucesso');
            closeItemModal();
            loadItems(currentItemsPage, currentItemsSearch);
        } else {
            showToast(data.message || 'Erro ao guardar artigo', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao guardar artigo', 'error');
        console.error(error);
    }
}

// Editar Artigo
function editItem(itemId) {
    openItemModal(itemId);
}

// Deletar Artigo
async function deleteItem(itemId) {
    if (!confirm('Tem certeza que deseja eliminar este artigo?')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/items.php?id=${itemId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            showToast('Artigo eliminado com sucesso');
            loadItems(currentItemsPage, currentItemsSearch);
            loadDashboard(); // Atualizar dashboard
        } else {
            showToast(data.message || 'Erro ao eliminar artigo', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao eliminar artigo', 'error');
        console.error(error);
    }
}

// Carregar Categorias para Select
async function loadCategoriesForSelect() {
    try {
        const response = await fetch(`${API_BASE}/categories.php`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            return;
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            return;
        }
        
        if (data.success && data.categories) {
            const select = document.getElementById('itemCategory');
            const currentValue = select.value;
            select.innerHTML = '<option value="">Selecione...</option>';
            
            data.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                select.appendChild(option);
            });
            
            select.value = currentValue;
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

// ==========================================
// Categories Management Functions
// ==========================================

// Carregar Categorias
async function loadCategories() {
    try {
        const search = document.getElementById('categorySearch')?.value || '';
        currentCategoriesSearch = search;
        
        const params = new URLSearchParams();
        if (search) {
            params.append('search', search);
        }
        
        const url = `${API_BASE}/categories.php${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            showToast('Erro ao carregar categorias', 'error');
            return;
        }
        
        if (data.success) {
            const categoriesList = document.getElementById('categoriesList');
            if (!categoriesList) return;
            
            categoriesList.innerHTML = '';
            
            if (data.categories && data.categories.length > 0) {
                data.categories.forEach(category => {
                    const categoryCard = document.createElement('div');
                    categoryCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
                    categoryCard.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h4 class="font-bold text-lg">${category.name}</h4>
                                <p class="text-sm text-gray-600 mt-1">${category.description || 'Sem descrição'}</p>
                                <p class="text-xs text-gray-500 mt-2">${category.items_count || 0} artigo(s)</p>
                            </div>
                            <div class="flex space-x-2 ml-4">
                                <button onclick="editCategory(${category.id})" 
                                        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                                    Editar
                                </button>
                                <button onclick="deleteCategory(${category.id})" 
                                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    `;
                    categoriesList.appendChild(categoryCard);
                });
            } else {
                categoriesList.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma categoria encontrada</p>';
            }
        }
    } catch (error) {
        showToast('Erro ao carregar categorias', 'error');
        console.error(error);
    }
}

// Abrir Modal de Categoria
async function openCategoryModal(categoryId = null) {
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    const modalTitle = document.getElementById('categoryModalTitle');
    
    if (!modal || !form || !modalTitle) {
        console.warn('Elementos de categoria não encontrados');
        return;
    }
    
    // Limpar formulário
    form.reset();
    const categoryIdEl = document.getElementById('categoryId');
    if (categoryIdEl) categoryIdEl.value = '';
    
    if (categoryId) {
        // Editar categoria existente
        modalTitle.textContent = 'Editar Categoria';
        try {
            showLoading();
            const response = await fetch(`${API_BASE}/categories.php?id=${categoryId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            let data;
            
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Erro ao fazer parse do JSON:', parseError);
                hideLoading();
                showToast('Erro ao carregar categoria', 'error');
                return;
            }
            
            hideLoading();
            
            if (data.success && data.category) {
                const category = data.category;
                const categoryIdEl = document.getElementById('categoryId');
                const categoryNameEl = document.getElementById('categoryName');
                const categoryDescriptionEl = document.getElementById('categoryDescription');
                if (categoryIdEl) categoryIdEl.value = category.id;
                if (categoryNameEl) categoryNameEl.value = category.name;
                if (categoryDescriptionEl) categoryDescriptionEl.value = category.description || '';
            }
        } catch (error) {
            hideLoading();
            showToast('Erro ao carregar categoria', 'error');
            console.error(error);
        }
    } else {
        // Nova categoria
        modalTitle.textContent = 'Nova Categoria';
    }
    
    modal.classList.remove('hidden');
}

// Fechar Modal de Categoria
function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
}

// Guardar Categoria
async function saveCategory(e) {
    e.preventDefault();
    
    const categoryIdEl = document.getElementById('categoryId');
    const categoryNameEl = document.getElementById('categoryName');
    const categoryDescriptionEl = document.getElementById('categoryDescription');
    
    if (!categoryIdEl || !categoryNameEl || !categoryDescriptionEl) {
        showToast('Elementos de categoria não encontrados', 'error');
        return;
    }
    
    const categoryId = categoryIdEl.value;
    const name = categoryNameEl.value;
    
    // Validação
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
        showToast(nameValidation.message, 'error');
        return;
    }
    
    const categoryData = {
        name: name,
        description: categoryDescriptionEl.value
    };
    
    if (categoryId) {
        categoryData.id = parseInt(categoryId);
    }
    
    try {
        showLoading();
        const method = categoryId ? 'PUT' : 'POST';
        
        const response = await fetch(`${API_BASE}/categories.php`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoryData),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            showToast(categoryId ? 'Categoria atualizada com sucesso' : 'Categoria criada com sucesso');
            closeCategoryModal();
            loadCategories();
            loadDashboard(); // Atualizar dashboard
        } else {
            showToast(data.message || 'Erro ao guardar categoria', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao guardar categoria', 'error');
        console.error(error);
    }
}

// Editar Categoria
function editCategory(categoryId) {
    openCategoryModal(categoryId);
}

// Deletar Categoria
async function deleteCategory(categoryId) {
    if (!confirm('Tem certeza que deseja eliminar esta categoria? Esta ação não pode ser desfeita se não houver artigos associados.')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/categories.php?id=${categoryId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            showToast('Categoria eliminada com sucesso');
            loadCategories();
            loadDashboard(); // Atualizar dashboard
        } else {
            showToast(data.message || 'Erro ao eliminar categoria', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao eliminar categoria', 'error');
        console.error(error);
    }
}

// ==========================================
// Stock History Functions
// ==========================================

// currentHistoryPage já declarado no topo do arquivo

// Carregar Histórico de Movimentações
async function loadStockHistory(page = 1) {
    try {
        showLoading();
        currentHistoryPage = page;
        
        const params = new URLSearchParams({
            page: page,
            limit: 20
        });
        
        const type = document.getElementById('historyType')?.value;
        const dateFrom = document.getElementById('historyDateFrom')?.value;
        const dateTo = document.getElementById('historyDateTo')?.value;
        
        if (type) {
            params.append('type', type);
        }
        if (dateFrom) {
            params.append('date_from', dateFrom);
        }
        if (dateTo) {
            params.append('date_to', dateTo);
        }
        
        const response = await fetch(`${API_BASE}/stock_history.php?${params.toString()}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao carregar histórico', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            const historyList = document.getElementById('historyList');
            historyList.innerHTML = '';
            
            if (data.movements && data.movements.length > 0) {
                data.movements.forEach(movement => {
                    const movementCard = document.createElement('div');
                    const typeColors = {
                        'entrada': 'bg-green-100 text-green-800 border-green-300',
                        'saida': 'bg-red-100 text-red-800 border-red-300',
                        'ajuste': 'bg-yellow-100 text-yellow-800 border-yellow-300',
                        'transferencia': 'bg-blue-100 text-blue-800 border-blue-300'
                    };
                    const colorClass = typeColors[movement.movement_type] || 'bg-gray-100 text-gray-800 border-gray-300';
                    
                    movementCard.className = `bg-white rounded-lg p-4 border-l-4 ${colorClass.split(' ')[2]} border`;
                    movementCard.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-center space-x-3 mb-2">
                                    <span class="px-2 py-1 rounded text-xs font-semibold ${colorClass}">
                                        ${movement.movement_type_label}
                                    </span>
                                    <span class="font-bold ${colorClass.split(' ')[0]}">
                                        ${movement.quantity > 0 ? '+' : ''}${movement.quantity}
                                    </span>
                                </div>
                                <h4 class="font-bold text-lg">${movement.item_name}</h4>
                                <p class="text-sm text-gray-600">Código: ${movement.barcode}</p>
                                ${movement.reason ? `<p class="text-xs text-gray-500 mt-1">${movement.reason}</p>` : ''}
                                <p class="text-xs text-gray-500 mt-2">
                                    Por: ${movement.user_name || 'Sistema'} | ${movement.formatted_date}
                                </p>
                            </div>
                        </div>
                    `;
                    historyList.appendChild(movementCard);
                });
                
                // Paginação
                if (data.pagination && data.pagination.pages > 1) {
                    const paginationDiv = document.getElementById('historyPagination');
                    paginationDiv.innerHTML = '';
                    
                    for (let i = 1; i <= data.pagination.pages; i++) {
                        const btn = document.createElement('button');
                        btn.className = `px-4 py-2 rounded-lg ${i === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`;
                        btn.textContent = i;
                        btn.onclick = () => loadStockHistory(i);
                        paginationDiv.appendChild(btn);
                    }
                } else {
                    document.getElementById('historyPagination').innerHTML = '';
                }
            } else {
                historyList.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma movimentação encontrada</p>';
            }
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao carregar histórico', 'error');
        console.error(error);
    }
}

// ==========================================
// Users Management Functions (Admin Only)
// ==========================================

// currentUsersPage e currentUsersSearch já declarados no topo do arquivo

// Carregar Utilizadores
async function loadUsers(page = 1, search = '') {
    try {
        showLoading();
        currentUsersPage = page;
        currentUsersSearch = search || document.getElementById('usersSearch')?.value || '';
        
        const params = new URLSearchParams({
            page: page,
            limit: 20
        });
        
        if (currentUsersSearch) {
            params.append('search', currentUsersSearch);
        }
        
        const response = await fetch(`${API_BASE}/users.php?${params.toString()}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao carregar utilizadores', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            const usersList = document.getElementById('usersList');
            usersList.innerHTML = '';
            
            if (data.users && data.users.length > 0) {
                data.users.forEach(user => {
                    const userCard = document.createElement('div');
                    userCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
                    userCard.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-center space-x-3">
                                    <h4 class="font-bold text-lg">${user.username}</h4>
                                    <span class="px-2 py-1 rounded text-xs font-semibold ${
                                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                    }">
                                        ${user.role === 'admin' ? 'Administrador' : 'Operador'}
                                    </span>
                                    ${!user.is_active ? '<span class="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">Inativo</span>' : ''}
                                </div>
                                <p class="text-sm text-gray-600 mt-1">${user.email}</p>
                                <p class="text-xs text-gray-500 mt-2">
                                    Criado: ${new Date(user.created_at).toLocaleDateString('pt-PT')}
                                </p>
                            </div>
                            <div class="flex space-x-2 ml-4">
                                <button onclick="editUser(${user.id})" 
                                        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                                    Editar
                                </button>
                                <button onclick="deleteUser(${user.id})" 
                                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    `;
                    usersList.appendChild(userCard);
                });
                
                // Paginação
                if (data.pagination && data.pagination.pages > 1) {
                    const paginationDiv = document.getElementById('usersPagination');
                    paginationDiv.innerHTML = '';
                    
                    for (let i = 1; i <= data.pagination.pages; i++) {
                        const btn = document.createElement('button');
                        btn.className = `px-4 py-2 rounded-lg ${i === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`;
                        btn.textContent = i;
                        btn.onclick = () => loadUsers(i);
                        paginationDiv.appendChild(btn);
                    }
                } else {
                    document.getElementById('usersPagination').innerHTML = '';
                }
            } else {
                usersList.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum utilizador encontrado</p>';
            }
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao carregar utilizadores', 'error');
        console.error(error);
    }
}

// Abrir Modal de Utilizador
async function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    const modalTitle = document.getElementById('userModalTitle');
    const passwordRequired = document.getElementById('passwordRequired');
    
    // Limpar formulário
    form.reset();
    document.getElementById('userId').value = '';
    if (passwordRequired) {
        passwordRequired.textContent = '*';
    }
    const passwordField = document.getElementById('userPassword');
    if (passwordField) {
        passwordField.required = true;
    }
    
    if (userId) {
        // Editar utilizador existente
        modalTitle.textContent = 'Editar Utilizador';
        if (passwordRequired) {
            passwordRequired.textContent = '';
        }
        if (passwordField) {
            passwordField.required = false;
        }
        
        try {
            showLoading();
            const response = await fetch(`${API_BASE}/users.php?id=${userId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            let data;
            
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Erro ao fazer parse do JSON:', parseError);
                hideLoading();
                showToast('Erro ao carregar utilizador', 'error');
                return;
            }
            
            hideLoading();
            
            if (data.success && data.user) {
                const user = data.user;
                document.getElementById('userId').value = user.id;
                document.getElementById('userUsername').value = user.username;
                document.getElementById('userEmail').value = user.email;
                document.getElementById('userRole').value = user.role;
                document.getElementById('userIsActive').checked = user.is_active == 1;
            }
        } catch (error) {
            hideLoading();
            showToast('Erro ao carregar utilizador', 'error');
            console.error(error);
        }
    } else {
        // Novo utilizador
        modalTitle.textContent = 'Novo Utilizador';
    }
    
    modal.classList.remove('hidden');
}

// Fechar Modal de Utilizador
function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
    document.getElementById('userForm').reset();
}

// Guardar Utilizador
async function saveUser(e) {
    e.preventDefault();
    
    const userId = document.getElementById('userId').value;
    const username = document.getElementById('userUsername').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const isActive = document.getElementById('userIsActive').checked;
    
    // Validações
    if (!username || !email) {
        showToast('Username e email são obrigatórios', 'error');
        return;
    }
    
    if (!userId && !password) {
        showToast('Password é obrigatória para novos utilizadores', 'error');
        return;
    }
    
    // Validar email (validação simples no cliente)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Email inválido', 'error');
        return;
    }
    
    const userData = {
        username: username,
        email: email,
        role: role,
        is_active: isActive
    };
    
    if (userId) {
        userData.id = parseInt(userId);
        if (password) {
            userData.password = password;
        }
    } else {
        userData.password = password;
    }
    
    try {
        showLoading();
        const method = userId ? 'PUT' : 'POST';
        
        const response = await fetch(`${API_BASE}/users.php`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            showToast(userId ? 'Utilizador atualizado com sucesso' : 'Utilizador criado com sucesso');
            closeUserModal();
            loadUsers(currentUsersPage, currentUsersSearch);
        } else {
            showToast(data.message || 'Erro ao guardar utilizador', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao guardar utilizador', 'error');
        console.error(error);
    }
}

// Editar Utilizador
function editUser(userId) {
    openUserModal(userId);
}

// Deletar Utilizador
async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja eliminar este utilizador?')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/users.php?id=${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            hideLoading();
            showToast('Erro ao processar resposta', 'error');
            return;
        }
        
        hideLoading();
        
        if (data.success) {
            showToast('Utilizador eliminado com sucesso');
            loadUsers(currentUsersPage, currentUsersSearch);
        } else {
            showToast(data.message || 'Erro ao eliminar utilizador', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Erro ao eliminar utilizador', 'error');
        console.error(error);
    }
}

// Tornar funções disponíveis globalmente
window.loadSessionInfo = loadSessionInfo;
window.closeSessionDetails = closeSessionDetails;
window.loadDashboard = loadDashboard;
window.loadItems = loadItems;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.closeItemInfo = closeItemInfo;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.openCategoryModal = openCategoryModal;
window.closeCountSetupModal = closeCountSetupModal;
window.confirmCountSetup = confirmCountSetup;
window.closeCategoryModal = closeCategoryModal;
window.loadStockHistory = loadStockHistory;
window.loadUsers = loadUsers;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.openCompanyModal = openCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.deleteCompany = deleteCompany;
window.openWarehouseModal = openWarehouseModal;
window.closeWarehouseModal = closeWarehouseModal;
window.deleteWarehouse = deleteWarehouse;

// ==========================================
// Delete All Items Functions
// ==========================================

function openDeleteAllItemsModal() {
    const modal = document.getElementById('deleteAllItemsModal');
    const confirmationInput = document.getElementById('deleteAllConfirmation');
    const confirmBtn = document.getElementById('confirmDeleteAllBtn');
    
    if (modal) {
        modal.classList.remove('hidden');
        if (confirmationInput) {
            confirmationInput.value = '';
            confirmationInput.focus();
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
    }
}

function closeDeleteAllItemsModal() {
    const modal = document.getElementById('deleteAllItemsModal');
    const confirmationInput = document.getElementById('deleteAllConfirmation');
    const confirmBtn = document.getElementById('confirmDeleteAllBtn');
    
    if (modal) {
        modal.classList.add('hidden');
    }
    if (confirmationInput) {
        confirmationInput.value = '';
    }
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
}

async function confirmDeleteAllItems() {
    const confirmationInput = document.getElementById('deleteAllConfirmation');
    const confirmation = confirmationInput ? confirmationInput.value.trim() : '';
    
    if (confirmation !== 'ELIMINAR TUDO') {
        showErrorToast('Confirmação Inválida', 'Digite "ELIMINAR TUDO" para confirmar');
        return;
    }
    
    try {
        showEnhancedLoading('Eliminando Artigos...', 'Esta operação pode demorar alguns momentos');
        
        const response = await fetch(`${API_BASE}/items.php?all=true`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                confirmation: confirmation
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        hideEnhancedLoading();
        
        if (data.success) {
            closeDeleteAllItemsModal();
            showSuccessToast('Artigos Eliminados', data.message);
            
            // Recarregar a lista de artigos e dashboard
            loadItems(1, '');
            loadDashboard();
            
            // Log da ação
            console.log(`Admin action: ${data.deleted_count} items deleted`);
            
        } else {
            showErrorToast('Erro ao Eliminar', data.message || 'Erro desconhecido');
        }
        
    } catch (error) {
        hideEnhancedLoading();
        showErrorToast('Erro de Conexão', 'Não foi possível eliminar os artigos');
        console.error('Error deleting all items:', error);
    }
}

// Event listeners para o modal de eliminar todos os artigos
document.addEventListener('DOMContentLoaded', function() {
    // Botão para abrir o modal
    const deleteAllItemsBtn = document.getElementById('deleteAllItemsBtn');
    if (deleteAllItemsBtn) {
        deleteAllItemsBtn.addEventListener('click', openDeleteAllItemsModal);
    }
    
    // Botões do modal
    const cancelDeleteAllBtn = document.getElementById('cancelDeleteAllBtn');
    if (cancelDeleteAllBtn) {
        cancelDeleteAllBtn.addEventListener('click', closeDeleteAllItemsModal);
    }
    
    const confirmDeleteAllBtn = document.getElementById('confirmDeleteAllBtn');
    if (confirmDeleteAllBtn) {
        confirmDeleteAllBtn.addEventListener('click', confirmDeleteAllItems);
    }
    
    // Input de confirmação
    const deleteAllConfirmation = document.getElementById('deleteAllConfirmation');
    if (deleteAllConfirmation) {
        deleteAllConfirmation.addEventListener('input', function(e) {
            const confirmBtn = document.getElementById('confirmDeleteAllBtn');
            if (confirmBtn) {
                confirmBtn.disabled = e.target.value.trim() !== 'ELIMINAR TUDO';
            }
        });
        
        // Enter para confirmar
        deleteAllConfirmation.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.target.value.trim() === 'ELIMINAR TUDO') {
                confirmDeleteAllItems();
            }
        });
    }
    
    // Fechar modal ao clicar fora
    const deleteAllItemsModal = document.getElementById('deleteAllItemsModal');
    if (deleteAllItemsModal) {
        deleteAllItemsModal.addEventListener('click', function(e) {
            if (e.target === deleteAllItemsModal) {
                closeDeleteAllItemsModal();
            }
        });
    }
});

// Tornar funções disponíveis globalmente
window.openDeleteAllItemsModal = openDeleteAllItemsModal;
window.closeDeleteAllItemsModal = closeDeleteAllItemsModal;
window.confirmDeleteAllItems = confirmDeleteAllItems;

// ==========================================
// Export Functions
// ==========================================

// Exportar Relatório
function exportReport(reportType = null, format = null) {
    const selectedType = reportType || document.getElementById('reportType')?.value || 'items';
    const selectedFormat = format || document.getElementById('exportFormat')?.value || 'csv';
    
    // Parâmetros adicionais baseados no tipo
    let url = `${API_BASE}/export_reports.php?type=${selectedType}&format=${selectedFormat}`;
    
    // Adicionar filtros para movimentações se aplicável
    if (selectedType === 'movements') {
        const historyType = document.getElementById('historyType')?.value;
        const dateFrom = document.getElementById('historyDateFrom')?.value;
        const dateTo = document.getElementById('historyDateTo')?.value;
        
        if (historyType) {
            url += `&movement_type=${historyType}`;
        }
        if (dateFrom) {
            url += `&date_from=${dateFrom}`;
        }
        if (dateTo) {
            url += `&date_to=${dateTo}`;
        }
    }
    
    // Abrir em nova janela para download
    window.open(url, '_blank');
    
    // Mostrar mensagem de sucesso
    const exportResult = document.getElementById('exportResult');
    if (exportResult) {
        exportResult.classList.remove('hidden');
        exportResult.className = 'mt-4 p-3 bg-green-50 rounded-lg text-green-800 text-sm';
        exportResult.textContent = 'Relatório sendo exportado... Verifique os seus downloads.';
        
        setTimeout(() => {
            exportResult.classList.add('hidden');
        }, 3000);
    } else {
        showToast('Relatório sendo exportado...', 'success');
    }
}

// Tornar função disponível globalmente
window.exportReport = exportReport;

// ===================================
// 🚀 UX ENHANCEMENTS - INVENTOX v2.0
// ===================================

// UX State Management
let uxState = {
    currentTab: 'scanner',
    breadcrumbsVisible: false,
    keyboardHintsVisible: true,
    lastActiveTab: localStorage.getItem('inventox_last_tab') || 'scanner'
};

// Initialize UX Enhancements
function initUXEnhancements() {
    initBreadcrumbs();
    initKeyboardShortcuts();
    initTabPersistence();
    initToastSystem();
    initLoadingEnhancements();
    
    log.debug('UX Enhancements initialized');
}

// ===================================
// 🧭 BREADCRUMBS SYSTEM
// ===================================

function initBreadcrumbs() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    const hideHintsBtn = document.getElementById('hideHintsBtn');
    
    if (hideHintsBtn) {
        hideHintsBtn.addEventListener('click', toggleKeyboardHints);
    }
    
    // Show breadcrumbs when dashboard is visible
    const observer = new MutationObserver(() => {
        const dashboardSection = document.getElementById('dashboardSection');
        if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
            showBreadcrumbs();
        }
    });
    
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) {
        observer.observe(dashboardSection, { attributes: true, attributeFilter: ['class'] });
    }
}

function showBreadcrumbs() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (breadcrumbs) {
        breadcrumbs.classList.remove('hidden');
        uxState.breadcrumbsVisible = true;
    }
}

function updateBreadcrumbs(section, subsection = null) {
    const breadcrumbSection = document.getElementById('breadcrumbSection');
    const breadcrumbSubsection = document.getElementById('breadcrumbSubsection');
    const separator1 = document.getElementById('breadcrumbSeparator1');
    const separator2 = document.getElementById('breadcrumbSeparator2');
    
    if (breadcrumbSection) {
        breadcrumbSection.textContent = section;
        breadcrumbSection.classList.remove('hidden');
        separator1.classList.remove('hidden');
    }
    
    if (subsection && breadcrumbSubsection) {
        breadcrumbSubsection.textContent = subsection;
        breadcrumbSubsection.classList.remove('hidden');
        separator2.classList.remove('hidden');
    } else if (breadcrumbSubsection) {
        breadcrumbSubsection.classList.add('hidden');
        separator2.classList.add('hidden');
    }
}

function toggleKeyboardHints() {
    const keyboardHints = document.getElementById('keyboardHints');
    const hideHintsBtn = document.getElementById('hideHintsBtn');
    
    if (uxState.keyboardHintsVisible) {
        keyboardHints.style.display = 'none';
        hideHintsBtn.textContent = 'Mostrar atalhos';
        uxState.keyboardHintsVisible = false;
        localStorage.setItem('inventox_keyboard_hints', 'false');
    } else {
        keyboardHints.style.display = 'flex';
        hideHintsBtn.textContent = 'Ocultar';
        uxState.keyboardHintsVisible = true;
        localStorage.setItem('inventox_keyboard_hints', 'true');
    }
}

// ===================================
// ⌨️ KEYBOARD SHORTCUTS
// ===================================

function initKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Load keyboard hints preference
    const hintsPreference = localStorage.getItem('inventox_keyboard_hints');
    if (hintsPreference === 'false') {
        uxState.keyboardHintsVisible = false;
        setTimeout(toggleKeyboardHints, 100);
    }
}

function handleKeyboardShortcuts(event) {
    // Don't trigger shortcuts when typing in inputs
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
        return;
    }
    
    if (event.ctrlKey || event.metaKey) {
        switch(event.key) {
            case '1':
                event.preventDefault();
                switchTabWithAnimation('dashboard');
                showSuccessToast('Dashboard', 'Navegação rápida ativada');
                break;
            case '2':
                event.preventDefault();
                switchTabWithAnimation('scanner');
                showSuccessToast('Scanner', 'Navegação rápida ativada');
                break;
            case '3':
                event.preventDefault();
                switchTabWithAnimation('items');
                showSuccessToast('Artigos', 'Navegação rápida ativada');
                break;
            case '4':
                event.preventDefault();
                switchTabWithAnimation('categories');
                showSuccessToast('Categorias', 'Navegação rápida ativada');
                break;
            case '5':
                event.preventDefault();
                switchTabWithAnimation('sessions');
                showSuccessToast('Sessões', 'Navegação rápida ativada');
                break;
            case 'k':
            case 'K':
                event.preventDefault();
                // TODO: Implement global search
                showSuccessToast('Pesquisa Global', 'Em breve disponível');
                break;
        }
    }
}

function switchTabWithAnimation(tabName) {
    // Add smooth transition effect
    const currentTab = document.querySelector('.tab-content:not(.hidden)');
    if (currentTab) {
        currentTab.style.opacity = '0';
        setTimeout(() => {
            switchTab(tabName);
            const newTab = document.querySelector('.tab-content:not(.hidden)');
            if (newTab) {
                newTab.style.opacity = '0';
                setTimeout(() => {
                    newTab.style.opacity = '1';
                }, 50);
            }
        }, 150);
    } else {
        switchTab(tabName);
    }
}

// ===================================
// 💾 TAB PERSISTENCE
// ===================================

function initTabPersistence() {
    // Restore last active tab
    if (uxState.lastActiveTab && uxState.lastActiveTab !== 'scanner') {
        setTimeout(() => {
            switchTab(uxState.lastActiveTab);
        }, 500);
    }
    
    // Override original switchTab to add persistence
    const originalSwitchTab = window.switchTab;
    if (originalSwitchTab) {
        window.switchTab = function(tabName) {
            originalSwitchTab(tabName);
            saveTabState(tabName);
            updateBreadcrumbsForTab(tabName);
        };
    }
}

function saveTabState(tabName) {
    uxState.currentTab = tabName;
    uxState.lastActiveTab = tabName;
    localStorage.setItem('inventox_last_tab', tabName);
}

function updateBreadcrumbsForTab(tabName) {
    const tabNames = {
        'dashboard': 'Dashboard',
        'scanner': 'Scanner',
        'items': 'Artigos',
        'categories': 'Categorias',
        'sessions': 'Sessões',
        'import': 'Importar',
        'history': 'Histórico',
        'users': 'Utilizadores',
        'companies': 'Empresas',
        'warehouses': 'Armazéns'
    };
    
    const sectionName = tabNames[tabName] || tabName;
    updateBreadcrumbs(sectionName);
}

// ===================================
// 🎉 ENHANCED TOAST SYSTEM
// ===================================

function initToastSystem() {
    // Auto-hide toasts after 4 seconds
    setTimeout(() => {
        const toasts = document.querySelectorAll('#successToast, #errorToast');
        toasts.forEach(toast => {
            if (!toast.classList.contains('hidden')) {
                hideToast(toast);
            }
        });
    }, 4000);
}

function showSuccessToast(title, message = '') {
    const toast = document.getElementById('successToast');
    const titleEl = document.getElementById('successToastTitle');
    const messageEl = document.getElementById('successToastMessage');
    
    if (toast && titleEl && messageEl) {
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 10);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            hideToast(toast);
        }, 3000);
    }
}

function showErrorToast(title, message = '') {
    const toast = document.getElementById('errorToast');
    const titleEl = document.getElementById('errorToastTitle');
    const messageEl = document.getElementById('errorToastMessage');
    
    if (toast && titleEl && messageEl) {
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 10);
        
        // Auto-hide after 4 seconds (errors stay longer)
        setTimeout(() => {
            hideToast(toast);
        }, 4000);
    }
}

function hideToast(toast) {
    toast.classList.add('translate-x-full');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 300);
}

// ===================================
// ⏳ ENHANCED LOADING SYSTEM
// ===================================

function initLoadingEnhancements() {
    // Override original showLoading if it exists
    const originalShowLoading = window.showLoading;
    if (originalShowLoading) {
        window.showLoading = showEnhancedLoading;
    }
}

function showEnhancedLoading(title = 'A carregar...', message = 'Por favor aguarde', showProgress = false) {
    const overlay = document.getElementById('loadingOverlay');
    const titleEl = document.getElementById('loadingTitle');
    const messageEl = document.getElementById('loadingMessage');
    const progressEl = document.getElementById('loadingProgress');
    
    if (overlay && titleEl && messageEl) {
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        if (showProgress && progressEl) {
            progressEl.classList.remove('hidden');
        } else if (progressEl) {
            progressEl.classList.add('hidden');
        }
        
        overlay.classList.remove('hidden');
    }
}

function updateLoadingProgress(percentage) {
    const progressBar = document.getElementById('loadingProgressBar');
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
}

function hideEnhancedLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Override original hideLoading
window.hideLoading = hideEnhancedLoading;
window.showLoading = showEnhancedLoading;

// ===================================
// 🎯 INITIALIZE ALL UX ENHANCEMENTS
// ===================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initUXEnhancements, 100);
});

// Initialize when dashboard becomes visible
const dashboardObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.id === 'dashboardSection' && !mutation.target.classList.contains('hidden')) {
            setTimeout(initUXEnhancements, 100);
        }
    });
});

const dashboardSection = document.getElementById('dashboardSection');
if (dashboardSection) {
    dashboardObserver.observe(dashboardSection, { attributes: true, attributeFilter: ['class'] });
}

// ===================================
// 📷 ENHANCED SCANNER SYSTEM - FASE 2
// ===================================

// Scanner Enhancement State
let scannerEnhancementState = {
    continuousMode: false,
    audioFeedback: false,
    autoFocus: true,
    scanHistory: JSON.parse(localStorage.getItem('inventox_scan_history') || '[]'),
    scanCount: parseInt(localStorage.getItem('inventox_scan_count_today') || '0'),
    lastScanDate: localStorage.getItem('inventox_last_scan_date') || '',
    pendingPreview: null,
    audioContext: null,
    scanSound: null
};

// Initialize Enhanced Scanner
function initEnhancedScanner() {
    initScannerControls();
    initScanHistory();
    initAudioFeedback();
    loadScannerPreferences();
    
    log.debug('Enhanced Scanner initialized');
}

// ===================================
// 🎛️ SCANNER CONTROLS
// ===================================

function initScannerControls() {
    const continuousModeCheckbox = document.getElementById('continuousScanMode');
    const audioFeedbackCheckbox = document.getElementById('audioFeedback');
    const autoFocusCheckbox = document.getElementById('autoFocus');
    const confirmScanBtn = document.getElementById('confirmScanBtn');
    const cancelScanBtn = document.getElementById('cancelScanBtn');
    
    if (continuousModeCheckbox) {
        continuousModeCheckbox.addEventListener('change', (e) => {
            scannerEnhancementState.continuousMode = e.target.checked;
            saveScannerPreferences();
            showSuccessToast('Modo Contínuo', e.target.checked ? 'Ativado' : 'Desativado');
        });
    }
    
    if (audioFeedbackCheckbox) {
        audioFeedbackCheckbox.addEventListener('change', (e) => {
            scannerEnhancementState.audioFeedback = e.target.checked;
            saveScannerPreferences();
            if (e.target.checked) {
                initAudioFeedback();
                playSuccessSound();
            }
            showSuccessToast('Som de Confirmação', e.target.checked ? 'Ativado' : 'Desativado');
        });
    }
    
    if (autoFocusCheckbox) {
        autoFocusCheckbox.addEventListener('change', (e) => {
            scannerEnhancementState.autoFocus = e.target.checked;
            saveScannerPreferences();
            showSuccessToast('Auto-foco', e.target.checked ? 'Ativado' : 'Desativado');
        });
    }
    
    if (confirmScanBtn) {
        confirmScanBtn.addEventListener('click', confirmPendingScan);
    }
    
    if (cancelScanBtn) {
        cancelScanBtn.addEventListener('click', cancelPendingScan);
    }
}

function loadScannerPreferences() {
    const preferences = JSON.parse(localStorage.getItem('inventox_scanner_preferences') || '{}');
    
    scannerEnhancementState.continuousMode = preferences.continuousMode || false;
    scannerEnhancementState.audioFeedback = preferences.audioFeedback || false;
    scannerEnhancementState.autoFocus = preferences.autoFocus !== false; // default true
    
    // Update UI
    const continuousModeCheckbox = document.getElementById('continuousScanMode');
    const audioFeedbackCheckbox = document.getElementById('audioFeedback');
    const autoFocusCheckbox = document.getElementById('autoFocus');
    
    if (continuousModeCheckbox) continuousModeCheckbox.checked = scannerEnhancementState.continuousMode;
    if (audioFeedbackCheckbox) audioFeedbackCheckbox.checked = scannerEnhancementState.audioFeedback;
    if (autoFocusCheckbox) autoFocusCheckbox.checked = scannerEnhancementState.autoFocus;
}

function saveScannerPreferences() {
    const preferences = {
        continuousMode: scannerEnhancementState.continuousMode,
        audioFeedback: scannerEnhancementState.audioFeedback,
        autoFocus: scannerEnhancementState.autoFocus
    };
    
    localStorage.setItem('inventox_scanner_preferences', JSON.stringify(preferences));
}

// ===================================
// 🔊 AUDIO FEEDBACK SYSTEM
// ===================================

function initAudioFeedback() {
    if (!scannerEnhancementState.audioFeedback) return;
    
    try {
        // Create AudioContext for generating beep sounds
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            scannerEnhancementState.audioContext = new AudioContext();
        }
    } catch (error) {
        log.debug('Audio feedback not available:', error);
    }
}

function playSuccessSound() {
    if (!scannerEnhancementState.audioFeedback || !scannerEnhancementState.audioContext) return;
    
    try {
        const audioContext = scannerEnhancementState.audioContext;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        log.debug('Error playing success sound:', error);
    }
}

function playErrorSound() {
    if (!scannerEnhancementState.audioFeedback || !scannerEnhancementState.audioContext) return;
    
    try {
        const audioContext = scannerEnhancementState.audioContext;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.15);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        log.debug('Error playing error sound:', error);
    }
}

// ===================================
// 📋 SCAN HISTORY SYSTEM
// ===================================

function initScanHistory() {
    updateScanCounter();
    renderScanHistory();
    
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearScanHistory);
    }
    
    // Reset daily counter if it's a new day
    const today = new Date().toDateString();
    if (scannerEnhancementState.lastScanDate !== today) {
        scannerEnhancementState.scanCount = 0;
        scannerEnhancementState.lastScanDate = today;
        localStorage.setItem('inventox_scan_count_today', '0');
        localStorage.setItem('inventox_last_scan_date', today);
    }
}

function addToScanHistory(barcode, itemName = null, success = true) {
    const scanEntry = {
        id: Date.now(),
        barcode: barcode,
        itemName: itemName || 'Item não encontrado',
        timestamp: new Date().toISOString(),
        success: success
    };
    
    // Add to beginning of array
    scannerEnhancementState.scanHistory.unshift(scanEntry);
    
    // Keep only last 10 scans
    if (scannerEnhancementState.scanHistory.length > 10) {
        scannerEnhancementState.scanHistory = scannerEnhancementState.scanHistory.slice(0, 10);
    }
    
    // Update daily counter
    if (success) {
        scannerEnhancementState.scanCount++;
        localStorage.setItem('inventox_scan_count_today', scannerEnhancementState.scanCount.toString());
    }
    
    // Save to localStorage
    localStorage.setItem('inventox_scan_history', JSON.stringify(scannerEnhancementState.scanHistory));
    
    // Update UI
    updateScanCounter();
    renderScanHistory();
}

function renderScanHistory() {
    const scanHistoryContainer = document.getElementById('scanHistory');
    if (!scanHistoryContainer) return;
    
    if (scannerEnhancementState.scanHistory.length === 0) {
        scanHistoryContainer.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <p class="text-sm">Nenhum scan realizado ainda</p>
                <p class="text-xs text-gray-400">Os últimos 10 scans aparecerão aqui</p>
            </div>
        `;
        return;
    }
    
    const historyHTML = scannerEnhancementState.scanHistory.map(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString('pt-PT', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const statusIcon = entry.success ? '✅' : '❌';
        const statusColor = entry.success ? 'text-green-600' : 'text-red-600';
        
        return `
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded border">
                <div class="flex items-center space-x-3">
                    <span class="text-lg">${statusIcon}</span>
                    <div>
                        <p class="text-sm font-medium text-gray-800">${entry.itemName}</p>
                        <p class="text-xs text-gray-500">${entry.barcode}</p>
                    </div>
                </div>
                <span class="text-xs ${statusColor}">${time}</span>
            </div>
        `;
    }).join('');
    
    scanHistoryContainer.innerHTML = historyHTML;
}

function updateScanCounter() {
    const scanCounter = document.getElementById('scanCounter');
    if (scanCounter) {
        const count = scannerEnhancementState.scanCount;
        scanCounter.textContent = `${count} scan${count !== 1 ? 's' : ''} hoje`;
    }
}

function clearScanHistory() {
    if (confirm('Tem certeza que deseja limpar o histórico de scans?')) {
        scannerEnhancementState.scanHistory = [];
        localStorage.setItem('inventox_scan_history', '[]');
        renderScanHistory();
        showSuccessToast('Histórico Limpo', 'Histórico de scans removido');
    }
}

// ===================================
// 🔍 ITEM PREVIEW SYSTEM
// ===================================

function showItemPreview(barcode, itemData) {
    const itemPreview = document.getElementById('itemPreview');
    const previewItemName = document.getElementById('previewItemName');
    const previewItemCode = document.getElementById('previewItemCode');
    const previewItemStock = document.getElementById('previewItemStock');
    
    if (!itemPreview || !previewItemName || !previewItemCode || !previewItemStock) return;
    
    // Store pending scan data
    scannerEnhancementState.pendingPreview = { barcode, itemData };
    
    // Update preview content
    previewItemName.textContent = itemData.name || 'Item não encontrado';
    previewItemCode.textContent = `Código: ${barcode}`;
    previewItemStock.textContent = `Stock: ${itemData.quantity || 0}`;
    
    // Show preview
    itemPreview.classList.remove('hidden');
    
    // Show scan success animation
    showScanSuccessAnimation();
    
    // Play success sound
    playSuccessSound();
    
    // Auto-confirm in continuous mode after 2 seconds
    if (scannerEnhancementState.continuousMode) {
        setTimeout(() => {
            if (scannerEnhancementState.pendingPreview) {
                confirmPendingScan();
            }
        }, 2000);
    }
}

function confirmPendingScan() {
    if (!scannerEnhancementState.pendingPreview) return;
    
    const { barcode, itemData } = scannerEnhancementState.pendingPreview;
    
    // Add to scan history
    addToScanHistory(barcode, itemData.name, true);
    
    // Process the scan (call original function)
    if (window.processBarcode) {
        window.processBarcode(barcode);
    }
    
    // Hide preview
    hideItemPreview();
    
    // Continue scanning in continuous mode
    if (scannerEnhancementState.continuousMode) {
        // Scanner continues automatically
        showSuccessToast('Scan Confirmado', 'Continuando digitalização...');
    }
}

function cancelPendingScan() {
    if (!scannerEnhancementState.pendingPreview) return;
    
    const { barcode } = scannerEnhancementState.pendingPreview;
    
    // Add to scan history as cancelled
    addToScanHistory(barcode, 'Scan cancelado', false);
    
    // Play error sound
    playErrorSound();
    
    // Hide preview
    hideItemPreview();
    
    showSuccessToast('Scan Cancelado', 'Digitalização cancelada');
}

function hideItemPreview() {
    const itemPreview = document.getElementById('itemPreview');
    if (itemPreview) {
        itemPreview.classList.add('hidden');
    }
    
    scannerEnhancementState.pendingPreview = null;
}

function showScanSuccessAnimation() {
    const scanSuccessOverlay = document.getElementById('scanSuccessOverlay');
    if (scanSuccessOverlay) {
        scanSuccessOverlay.classList.remove('hidden');
        setTimeout(() => {
            scanSuccessOverlay.classList.add('hidden');
        }, 1000);
    }
}

// ===================================
// 🔗 INTEGRATION WITH EXISTING SCANNER
// ===================================

// Override the original barcode processing to add preview
const originalProcessBarcode = window.processBarcode;
if (originalProcessBarcode) {
    window.processBarcode = function(barcode) {
        // If continuous mode is off, show preview
        if (!scannerEnhancementState.continuousMode) {
            // Fetch item data for preview
            fetchItemForPreview(barcode);
        } else {
            // In continuous mode, process directly
            addToScanHistory(barcode, 'Item processado', true);
            playSuccessSound();
            originalProcessBarcode(barcode);
        }
    };
}

async function fetchItemForPreview(barcode) {
    try {
        showEnhancedLoading('Verificando item...', 'Consultando base de dados');
        
        const response = await fetch(`${API_BASE}/items.php?barcode=${encodeURIComponent(barcode)}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        hideEnhancedLoading();
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.item) {
                showItemPreview(barcode, data.item);
            } else {
                // Item not found, show preview with empty data
                showItemPreview(barcode, { name: 'Item não encontrado', quantity: 0 });
            }
        } else {
            throw new Error('Erro ao consultar item');
        }
    } catch (error) {
        hideEnhancedLoading();
        showErrorToast('Erro', 'Não foi possível consultar o item');
        playErrorSound();
        addToScanHistory(barcode, 'Erro na consulta', false);
    }
}

// ===================================
// 🎯 INITIALIZE ENHANCED SCANNER
// ===================================

// Initialize when scanner tab becomes active
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initEnhancedScanner, 200);
});

// Also initialize when switching to scanner tab
const originalSwitchTab = window.switchTab;
if (originalSwitchTab) {
    const enhancedSwitchTab = window.switchTab;
    window.switchTab = function(tabName) {
        enhancedSwitchTab(tabName);
        if (tabName === 'scanner') {
            setTimeout(initEnhancedScanner, 100);
        } else if (tabName === 'dashboard') {
            setTimeout(initInteractiveDashboard, 100);
        }
    };
}

// ===================================
// 📊 INTERACTIVE DASHBOARD SYSTEM - FASE 3
// ===================================

// Dashboard Enhancement State
let dashboardState = {
    widgets: {},
    layout: JSON.parse(localStorage.getItem('inventox_dashboard_layout') || 'null'),
    realTimeEnabled: true,
    updateInterval: null,
    alerts: [],
    metrics: {
        scansToday: 0,
        activeSessions: 0,
        alerts: 0,
        efficiency: 0,
        scansPerHour: 0,
        avgScanTime: 0
    }
};

// Initialize Interactive Dashboard
function initInteractiveDashboard() {
    initDashboardControls();
    initWidgetSystem();
    initRealTimeMetrics();
    initSmartAlerts();
    loadDashboardLayout();
    
    log.debug('Interactive Dashboard initialized');
}

// ===================================
// 🎛️ DASHBOARD CONTROLS
// ===================================

function initDashboardControls() {
    const refreshBtn = document.getElementById('refreshDashboard');
    const customizeBtn = document.getElementById('customizeDashboard');
    const resetBtn = document.getElementById('resetDashboard');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshAllWidgets();
            showSuccessToast('Dashboard Atualizado', 'Todos os dados foram atualizados');
        });
    }
    
    if (customizeBtn) {
        customizeBtn.addEventListener('click', toggleCustomizeMode);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetDashboardLayout);
    }
}

function toggleCustomizeMode() {
    const widgetsGrid = document.getElementById('widgetsGrid');
    const customizeBtn = document.getElementById('customizeDashboard');
    
    if (widgetsGrid.classList.contains('customize-mode')) {
        // Exit customize mode
        widgetsGrid.classList.remove('customize-mode');
        customizeBtn.textContent = '⚙️ Personalizar';
        customizeBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
        customizeBtn.classList.add('bg-purple-500', 'hover:bg-purple-600');
        saveDashboardLayout();
        showSuccessToast('Layout Salvo', 'Personalização aplicada com sucesso');
    } else {
        // Enter customize mode
        widgetsGrid.classList.add('customize-mode');
        customizeBtn.textContent = '💾 Salvar Layout';
        customizeBtn.classList.remove('bg-purple-500', 'hover:bg-purple-600');
        customizeBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
        showSuccessToast('Modo Personalização', 'Arraste os widgets para reorganizar');
    }
}

function resetDashboardLayout() {
    if (confirm('Tem certeza que deseja resetar o layout do dashboard?')) {
        localStorage.removeItem('inventox_dashboard_layout');
        dashboardState.layout = null;
        location.reload(); // Reload to reset layout
    }
}

// ===================================
// 🧩 WIDGET SYSTEM
// ===================================

function initWidgetSystem() {
    const widgets = document.querySelectorAll('.widget');
    
    widgets.forEach(widget => {
        const widgetId = widget.getAttribute('data-widget');
        dashboardState.widgets[widgetId] = {
            element: widget,
            visible: true,
            position: null,
            lastUpdate: null
        };
        
        // Add widget controls
        initWidgetControls(widget, widgetId);
    });
    
    // Make widgets draggable (simplified version)
    initWidgetDragDrop();
}

function initWidgetControls(widget, widgetId) {
    const refreshBtn = widget.querySelector('.widget-refresh');
    const configBtn = widget.querySelector('.widget-config');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refreshWidget(widgetId);
        });
    }
    
    if (configBtn) {
        configBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showWidgetConfig(widgetId);
        });
    }
}

function refreshWidget(widgetId) {
    const widget = dashboardState.widgets[widgetId];
    if (!widget) return;
    
    // Add loading state
    const content = widget.element.querySelector('.widget-content');
    const originalContent = content.innerHTML;
    
    content.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    `;
    
    // Simulate refresh delay
    setTimeout(() => {
        content.innerHTML = originalContent;
        updateWidgetData(widgetId);
        showSuccessToast('Widget Atualizado', `${widgetId} foi atualizado`);
    }, 1000);
}

function showWidgetConfig(widgetId) {
    showSuccessToast('Configuração', `Configurações do widget ${widgetId} em breve`);
}

function initWidgetDragDrop() {
    // Simplified drag and drop - in a real implementation, you'd use a library like Sortable.js
    const widgets = document.querySelectorAll('.widget');
    
    widgets.forEach(widget => {
        const header = widget.querySelector('.widget-header');
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (document.getElementById('widgetsGrid').classList.contains('customize-mode')) {
                    widget.style.opacity = '0.7';
                    widget.style.transform = 'scale(0.95)';
                }
            });
            
            header.addEventListener('mouseup', () => {
                widget.style.opacity = '1';
                widget.style.transform = 'scale(1)';
            });
        }
    });
}

// ===================================
// ⏱️ REAL-TIME METRICS SYSTEM
// ===================================

function initRealTimeMetrics() {
    updateDashboardMetrics();
    
    // Update every 30 seconds
    if (dashboardState.realTimeEnabled) {
        dashboardState.updateInterval = setInterval(() => {
            updateDashboardMetrics();
        }, 30000);
    }
}

async function updateDashboardMetrics() {
    try {
        // Get scan history from localStorage
        const scanHistory = JSON.parse(localStorage.getItem('inventox_scan_history') || '[]');
        const scanCount = parseInt(localStorage.getItem('inventox_scan_count_today') || '0');
        
        // Calculate metrics
        const now = new Date();
        const todayScans = scanHistory.filter(scan => {
            const scanDate = new Date(scan.timestamp);
            return scanDate.toDateString() === now.toDateString();
        });
        
        const scansPerHour = todayScans.length > 0 ? Math.round(todayScans.length / (now.getHours() + 1)) : 0;
        const avgScanTime = todayScans.length > 1 ? 
            Math.round((todayScans[0].timestamp - todayScans[todayScans.length - 1].timestamp) / todayScans.length / 1000) : 0;
        const efficiency = Math.min(100, Math.round((scanCount / Math.max(1, scansPerHour * 8)) * 100));
        
        // Update metrics state
        dashboardState.metrics = {
            scansToday: scanCount,
            activeSessions: await getActiveSessions(),
            alerts: dashboardState.alerts.length,
            efficiency: efficiency,
            scansPerHour: scansPerHour,
            avgScanTime: avgScanTime
        };
        
        // Update UI
        updateQuickStats();
        updatePerformanceWidget();
        updateRecentScansWidget();
        
        // Check for alerts
        checkSmartAlerts();
        
    } catch (error) {
        log.debug('Error updating dashboard metrics:', error);
    }
}

function updateQuickStats() {
    const elements = {
        quickStatScans: dashboardState.metrics.scansToday,
        quickStatSessions: dashboardState.metrics.activeSessions,
        quickStatAlerts: dashboardState.metrics.alerts,
        quickStatEfficiency: dashboardState.metrics.efficiency + '%'
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

function updatePerformanceWidget() {
    const scansPerHourEl = document.getElementById('scansPerHour');
    const avgScanTimeEl = document.getElementById('avgScanTime');
    const efficiencyBarEl = document.getElementById('efficiencyBar');
    const efficiencyPercentEl = document.getElementById('efficiencyPercent');
    
    if (scansPerHourEl) scansPerHourEl.textContent = dashboardState.metrics.scansPerHour;
    if (avgScanTimeEl) avgScanTimeEl.textContent = dashboardState.metrics.avgScanTime + 's';
    if (efficiencyBarEl) efficiencyBarEl.style.width = dashboardState.metrics.efficiency + '%';
    if (efficiencyPercentEl) efficiencyPercentEl.textContent = dashboardState.metrics.efficiency + '%';
}

function updateRecentScansWidget() {
    const recentScansList = document.getElementById('recentScansList');
    if (!recentScansList) return;
    
    const scanHistory = JSON.parse(localStorage.getItem('inventox_scan_history') || '[]');
    const recentScans = scanHistory.slice(0, 5);
    
    if (recentScans.length === 0) {
        recentScansList.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <p class="text-sm">Nenhum scan recente</p>
            </div>
        `;
        return;
    }
    
    const scansHTML = recentScans.map(scan => {
        const time = new Date(scan.timestamp).toLocaleTimeString('pt-PT', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const statusIcon = scan.success ? '✅' : '❌';
        
        return `
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div class="flex items-center space-x-2">
                    <span>${statusIcon}</span>
                    <span class="truncate">${scan.itemName}</span>
                </div>
                <span class="text-xs text-gray-500">${time}</span>
            </div>
        `;
    }).join('');
    
    recentScansList.innerHTML = scansHTML;
}

async function getActiveSessions() {
    try {
        const response = await fetch(`${API_BASE}/session_count.php`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.sessions) {
                return data.sessions.filter(session => session.status === 'open').length;
            }
        }
    } catch (error) {
        log.debug('Error fetching active sessions:', error);
    }
    
    return 0;
}

// ===================================
// 🚨 SMART ALERTS SYSTEM
// ===================================

function initSmartAlerts() {
    dashboardState.alerts = JSON.parse(localStorage.getItem('inventox_dashboard_alerts') || '[]');
    
    const dismissAllBtn = document.getElementById('dismissAllAlerts');
    if (dismissAllBtn) {
        dismissAllBtn.addEventListener('click', dismissAllAlerts);
    }
    
    renderAlerts();
}

function checkSmartAlerts() {
    const newAlerts = [];
    
    // Low efficiency alert
    if (dashboardState.metrics.efficiency < 50 && dashboardState.metrics.scansToday > 10) {
        newAlerts.push({
            id: 'low-efficiency',
            type: 'warning',
            title: 'Eficiência Baixa',
            message: `Eficiência atual: ${dashboardState.metrics.efficiency}%. Considere otimizar o processo.`,
            timestamp: Date.now()
        });
    }
    
    // High scan rate alert
    if (dashboardState.metrics.scansPerHour > 100) {
        newAlerts.push({
            id: 'high-scan-rate',
            type: 'success',
            title: 'Alta Produtividade',
            message: `Excelente! ${dashboardState.metrics.scansPerHour} scans/hora.`,
            timestamp: Date.now()
        });
    }
    
    // No activity alert
    if (dashboardState.metrics.scansToday === 0 && new Date().getHours() > 9) {
        newAlerts.push({
            id: 'no-activity',
            type: 'info',
            title: 'Sem Atividade',
            message: 'Nenhum scan registado hoje. Inicie o trabalho de inventário.',
            timestamp: Date.now()
        });
    }
    
    // Add new alerts (avoid duplicates)
    newAlerts.forEach(alert => {
        if (!dashboardState.alerts.find(a => a.id === alert.id)) {
            dashboardState.alerts.push(alert);
        }
    });
    
    // Remove old alerts (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    dashboardState.alerts = dashboardState.alerts.filter(alert => alert.timestamp > oneHourAgo);
    
    // Save and render
    localStorage.setItem('inventox_dashboard_alerts', JSON.stringify(dashboardState.alerts));
    renderAlerts();
}

function renderAlerts() {
    const alertsPanel = document.getElementById('smartAlerts');
    const alertsList = document.getElementById('alertsList');
    
    if (!alertsPanel || !alertsList) return;
    
    if (dashboardState.alerts.length === 0) {
        alertsPanel.classList.add('hidden');
        return;
    }
    
    alertsPanel.classList.remove('hidden');
    
    const alertsHTML = dashboardState.alerts.map(alert => {
        const typeColors = {
            success: 'bg-green-100 border-green-300 text-green-800',
            warning: 'bg-yellow-100 border-yellow-300 text-yellow-800',
            error: 'bg-red-100 border-red-300 text-red-800',
            info: 'bg-blue-100 border-blue-300 text-blue-800'
        };
        
        const typeIcons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        
        return `
            <div class="flex items-center justify-between p-3 rounded border ${typeColors[alert.type]}">
                <div class="flex items-center space-x-3">
                    <span class="text-lg">${typeIcons[alert.type]}</span>
                    <div>
                        <div class="font-semibold">${alert.title}</div>
                        <div class="text-sm opacity-90">${alert.message}</div>
                    </div>
                </div>
                <button onclick="dismissAlert('${alert.id}')" class="text-sm opacity-70 hover:opacity-100">✕</button>
            </div>
        `;
    }).join('');
    
    alertsList.innerHTML = alertsHTML;
}

function dismissAlert(alertId) {
    dashboardState.alerts = dashboardState.alerts.filter(alert => alert.id !== alertId);
    localStorage.setItem('inventox_dashboard_alerts', JSON.stringify(dashboardState.alerts));
    renderAlerts();
}

function dismissAllAlerts() {
    dashboardState.alerts = [];
    localStorage.setItem('inventox_dashboard_alerts', '[]');
    renderAlerts();
    showSuccessToast('Alertas Limpos', 'Todos os alertas foram dispensados');
}

// ===================================
// 💾 LAYOUT PERSISTENCE
// ===================================

function saveDashboardLayout() {
    const widgetsGrid = document.getElementById('widgetsGrid');
    const widgets = Array.from(widgetsGrid.querySelectorAll('.widget'));
    
    const layout = widgets.map((widget, index) => ({
        id: widget.getAttribute('data-widget'),
        order: index,
        visible: !widget.classList.contains('hidden')
    }));
    
    dashboardState.layout = layout;
    localStorage.setItem('inventox_dashboard_layout', JSON.stringify(layout));
}

function loadDashboardLayout() {
    if (!dashboardState.layout) return;
    
    const widgetsGrid = document.getElementById('widgetsGrid');
    const widgets = Array.from(widgetsGrid.querySelectorAll('.widget'));
    
    // Sort widgets according to saved layout
    dashboardState.layout
        .sort((a, b) => a.order - b.order)
        .forEach(layoutItem => {
            const widget = widgets.find(w => w.getAttribute('data-widget') === layoutItem.id);
            if (widget) {
                widgetsGrid.appendChild(widget);
                if (!layoutItem.visible) {
                    widget.classList.add('hidden');
                }
            }
        });
}

// ===================================
// 🔄 WIDGET DATA UPDATES
// ===================================

function updateWidgetData(widgetId) {
    switch (widgetId) {
        case 'kpi-metrics':
            updateKPIMetrics();
            break;
        case 'activity-chart':
            updateActivityChart();
            break;
        case 'low-stock':
            updateLowStockWidget();
            break;
        case 'recent-scans':
            updateRecentScansWidget();
            break;
        case 'top-categories':
            updateTopCategoriesWidget();
            break;
        case 'performance':
            updatePerformanceWidget();
            break;
    }
}

async function updateKPIMetrics() {
    // This would typically fetch from API
    // For now, using mock data
    const elements = {
        statTotalItems: Math.floor(Math.random() * 1000) + 500,
        statLowStock: Math.floor(Math.random() * 20) + 5,
        statOpenSessions: Math.floor(Math.random() * 5) + 1,
        statInventoryValue: (Math.random() * 100000 + 50000).toFixed(0) + ' CVE'
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

function updateActivityChart() {
    // Update the simple bar chart with random data
    const bars = document.querySelectorAll('[data-widget="activity-chart"] .bg-blue-500');
    bars.forEach(bar => {
        const height = Math.random() * 80 + 20;
        bar.style.height = height + '%';
    });
}

async function updateLowStockWidget() {
    const lowStockList = document.getElementById('lowStockList');
    const lowStockCount = document.getElementById('lowStockCount');
    
    if (!lowStockList || !lowStockCount) return;
    
    // Mock low stock items
    const mockLowStock = [
        { name: 'Produto A', stock: 2, min: 10 },
        { name: 'Produto B', stock: 1, min: 5 },
        { name: 'Produto C', stock: 0, min: 8 }
    ];
    
    lowStockCount.textContent = mockLowStock.length;
    
    const itemsHTML = mockLowStock.map(item => `
        <div class="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
            <div>
                <div class="font-medium text-sm">${item.name}</div>
                <div class="text-xs text-gray-500">Stock: ${item.stock} / Min: ${item.min}</div>
            </div>
            <div class="text-red-600 font-bold">${item.stock}</div>
        </div>
    `).join('');
    
    lowStockList.innerHTML = itemsHTML;
}

async function updateTopCategoriesWidget() {
    const topCategoriesList = document.getElementById('topCategoriesList');
    if (!topCategoriesList) return;
    
    // Mock categories data
    const mockCategories = [
        { name: 'Eletrónicos', count: 45, percentage: 35 },
        { name: 'Vestuário', count: 32, percentage: 25 },
        { name: 'Casa & Jardim', count: 28, percentage: 22 },
        { name: 'Desporto', count: 15, percentage: 12 },
        { name: 'Livros', count: 8, percentage: 6 }
    ];
    
    const categoriesHTML = mockCategories.map(category => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div class="flex-1">
                <div class="font-medium text-sm">${category.name}</div>
                <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${category.percentage}%"></div>
                </div>
            </div>
            <div class="ml-3 text-right">
                <div class="font-bold text-sm">${category.count}</div>
                <div class="text-xs text-gray-500">${category.percentage}%</div>
            </div>
        </div>
    `).join('');
    
    topCategoriesList.innerHTML = categoriesHTML;
}

function refreshAllWidgets() {
    Object.keys(dashboardState.widgets).forEach(widgetId => {
        updateWidgetData(widgetId);
    });
    
    updateDashboardMetrics();
}

// Make dismissAlert available globally
window.dismissAlert = dismissAlert;

// ===================================
// 🎯 INITIALIZE INTERACTIVE DASHBOARD
// ===================================

// Initialize when dashboard tab becomes active
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (document.getElementById('dashboardTab') && !document.getElementById('dashboardTab').classList.contains('hidden')) {
            initInteractiveDashboard();
        }
    }, 300);
});

// ===================================
// 🔍 GLOBAL SEARCH SYSTEM - FASE 4
// ===================================

// Global Search State
let globalSearchState = {
    isOpen: false,
    currentFilter: 'all',
    searchHistory: JSON.parse(localStorage.getItem('inventox_search_history') || '[]'),
    selectedIndex: -1,
    currentResults: [],
    searchTimeout: null,
    voiceRecognition: null,
    isVoiceActive: false
};

// Initialize Global Search
function initGlobalSearch() {
    initSearchModal();
    initSearchFilters();
    initSearchHistory();
    initVoiceSearch();
    initKeyboardShortcuts();
    
    log.debug('Global Search initialized');
}

// ===================================
// 🎛️ SEARCH MODAL CONTROLS
// ===================================

function initSearchModal() {
    const searchModal = document.getElementById('globalSearchModal');
    const searchInput = document.getElementById('globalSearchInput');
    const closeBtn = document.getElementById('closeSearchBtn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeGlobalSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keydown', handleSearchKeydown);
    }
    
    // Click outside to close
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                closeGlobalSearch();
            }
        });
    }
    
    // Initialize suggestions
    initSearchSuggestions();
}

function openGlobalSearch() {
    const searchModal = document.getElementById('globalSearchModal');
    const searchInput = document.getElementById('globalSearchInput');
    
    if (searchModal && searchInput) {
        globalSearchState.isOpen = true;
        searchModal.classList.remove('hidden');
        
        // Focus input after animation
        setTimeout(() => {
            searchInput.focus();
        }, 100);
        
        // Show suggestions and history
        showSearchSuggestions();
        renderSearchHistory();
        
        log.debug('Global search opened');
    }
}

function closeGlobalSearch() {
    const searchModal = document.getElementById('globalSearchModal');
    const searchInput = document.getElementById('globalSearchInput');
    
    if (searchModal && searchInput) {
        globalSearchState.isOpen = false;
        searchModal.classList.add('hidden');
        searchInput.value = '';
        
        // Reset state
        globalSearchState.selectedIndex = -1;
        globalSearchState.currentResults = [];
        
        // Stop voice search if active
        if (globalSearchState.isVoiceActive) {
            stopVoiceSearch();
        }
        
        // Clear search timeout
        if (globalSearchState.searchTimeout) {
            clearTimeout(globalSearchState.searchTimeout);
        }
        
        log.debug('Global search closed');
    }
}

// ===================================
// 🏷️ SEARCH FILTERS
// ===================================

function initSearchFilters() {
    const filterButtons = document.querySelectorAll('.search-filter');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.getAttribute('data-filter');
            setSearchFilter(filter);
        });
    });
}

function setSearchFilter(filter) {
    globalSearchState.currentFilter = filter;
    
    // Update UI
    const filterButtons = document.querySelectorAll('.search-filter');
    filterButtons.forEach(button => {
        if (button.getAttribute('data-filter') === filter) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Re-run search if there's a query
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput && searchInput.value.trim()) {
        performSearch(searchInput.value.trim());
    }
    
    showSuccessToast('Filtro Ativo', `Pesquisando em: ${getFilterName(filter)}`);
}

function getFilterName(filter) {
    const names = {
        'all': 'Tudo',
        'items': 'Artigos',
        'sessions': 'Sessões',
        'users': 'Utilizadores',
        'categories': 'Categorias'
    };
    return names[filter] || 'Tudo';
}

// ===================================
// 🔍 SEARCH FUNCTIONALITY
// ===================================

function handleSearchInput(event) {
    const query = event.target.value.trim();
    
    // Clear previous timeout
    if (globalSearchState.searchTimeout) {
        clearTimeout(globalSearchState.searchTimeout);
    }
    
    if (query.length === 0) {
        showSearchSuggestions();
        return;
    }
    
    if (query.length < 2) {
        return; // Wait for at least 2 characters
    }
    
    // Debounce search
    globalSearchState.searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 300);
}

function handleSearchKeydown(event) {
    const results = globalSearchState.currentResults;
    
    switch (event.key) {
        case 'Escape':
            event.preventDefault();
            closeGlobalSearch();
            break;
            
        case 'ArrowDown':
            event.preventDefault();
            if (results.length > 0) {
                globalSearchState.selectedIndex = Math.min(
                    globalSearchState.selectedIndex + 1,
                    results.length - 1
                );
                updateSelectedResult();
            }
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            if (results.length > 0) {
                globalSearchState.selectedIndex = Math.max(
                    globalSearchState.selectedIndex - 1,
                    -1
                );
                updateSelectedResult();
            }
            break;
            
        case 'Enter':
            event.preventDefault();
            if (globalSearchState.selectedIndex >= 0 && results[globalSearchState.selectedIndex]) {
                selectSearchResult(results[globalSearchState.selectedIndex]);
            } else if (event.target.value.trim()) {
                // Perform search with current query
                addToSearchHistory(event.target.value.trim());
                performSearch(event.target.value.trim());
            }
            break;
    }
}

async function performSearch(query) {
    const startTime = Date.now();
    
    try {
        showEnhancedLoading('Pesquisando...', `Procurando por "${query}"`);
        
        // Simulate search across different data sources
        const results = await searchAllSources(query, globalSearchState.currentFilter);
        
        const searchTime = Date.now() - startTime;
        
        hideEnhancedLoading();
        
        globalSearchState.currentResults = results;
        globalSearchState.selectedIndex = -1;
        
        displaySearchResults(results, query, searchTime);
        
        // Add to search history
        addToSearchHistory(query);
        
    } catch (error) {
        hideEnhancedLoading();
        showErrorToast('Erro na Pesquisa', 'Não foi possível realizar a pesquisa');
        log.debug('Search error:', error);
    }
}

async function searchAllSources(query, filter) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // Search in different sources based on filter
    if (filter === 'all' || filter === 'items') {
        // Mock items search
        const itemResults = [
            { type: 'item', id: 1, title: 'Produto Exemplo A', description: 'Código: ABC123', stock: 15, category: 'Eletrónicos' },
            { type: 'item', id: 2, title: 'Produto Exemplo B', description: 'Código: DEF456', stock: 3, category: 'Vestuário' },
            { type: 'item', id: 3, title: 'Produto Exemplo C', description: 'Código: GHI789', stock: 0, category: 'Casa' }
        ].filter(item => 
            item.title.toLowerCase().includes(lowerQuery) ||
            item.description.toLowerCase().includes(lowerQuery) ||
            item.category.toLowerCase().includes(lowerQuery)
        );
        
        results.push(...itemResults);
    }
    
    if (filter === 'all' || filter === 'sessions') {
        // Mock sessions search
        const sessionResults = [
            { type: 'session', id: 1, title: 'Sessão Inventário Loja A', description: 'Criada em 10/11/2024', status: 'open', items: 25 },
            { type: 'session', id: 2, title: 'Sessão Inventário Armazém', description: 'Criada em 09/11/2024', status: 'closed', items: 150 }
        ].filter(session => 
            session.title.toLowerCase().includes(lowerQuery) ||
            session.description.toLowerCase().includes(lowerQuery)
        );
        
        results.push(...sessionResults);
    }
    
    if (filter === 'all' || filter === 'users') {
        // Mock users search
        const userResults = [
            { type: 'user', id: 1, title: 'João Silva', description: 'Operador - Ativo', role: 'operador', email: 'joao@example.com' },
            { type: 'user', id: 2, title: 'Maria Santos', description: 'Administrador - Ativo', role: 'admin', email: 'maria@example.com' }
        ].filter(user => 
            user.title.toLowerCase().includes(lowerQuery) ||
            user.role.toLowerCase().includes(lowerQuery) ||
            user.email.toLowerCase().includes(lowerQuery)
        );
        
        results.push(...userResults);
    }
    
    if (filter === 'all' || filter === 'categories') {
        // Mock categories search
        const categoryResults = [
            { type: 'category', id: 1, title: 'Eletrónicos', description: '45 artigos', count: 45 },
            { type: 'category', id: 2, title: 'Vestuário', description: '32 artigos', count: 32 },
            { type: 'category', id: 3, title: 'Casa & Jardim', description: '28 artigos', count: 28 }
        ].filter(category => 
            category.title.toLowerCase().includes(lowerQuery)
        );
        
        results.push(...categoryResults);
    }
    
    // Add scan history results
    const scanHistory = JSON.parse(localStorage.getItem('inventox_scan_history') || '[]');
    const scanResults = scanHistory
        .filter(scan => 
            scan.itemName.toLowerCase().includes(lowerQuery) ||
            scan.barcode.includes(query)
        )
        .slice(0, 5)
        .map(scan => ({
            type: 'scan',
            id: scan.id,
            title: scan.itemName,
            description: `Código: ${scan.barcode} - ${new Date(scan.timestamp).toLocaleString('pt-PT')}`,
            success: scan.success,
            timestamp: scan.timestamp
        }));
    
    results.push(...scanResults);
    
    // Sort by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
        const aExact = a.title.toLowerCase() === lowerQuery;
        const bExact = b.title.toLowerCase() === lowerQuery;
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        return a.title.localeCompare(b.title);
    });
    
    return results.slice(0, 20); // Limit to 20 results
}

function displaySearchResults(results, query, searchTime) {
    const searchResults = document.getElementById('searchResults');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const searchResultsCount = document.getElementById('searchResultsCount');
    const searchResultsTime = document.getElementById('searchResultsTime');
    const searchResultsList = document.getElementById('searchResultsList');
    
    if (!searchResults || !searchResultsList) return;
    
    // Hide suggestions, show results
    if (searchSuggestions) searchSuggestions.classList.add('hidden');
    searchResults.classList.remove('hidden');
    
    // Update count and time
    if (searchResultsCount) {
        searchResultsCount.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
    }
    if (searchResultsTime) {
        searchResultsTime.textContent = `(${searchTime}ms)`;
    }
    
    // Render results
    if (results.length === 0) {
        searchResultsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">🔍</div>
                <p class="text-sm">Nenhum resultado encontrado para "${query}"</p>
                <p class="text-xs text-gray-400 mt-1">Tente usar termos diferentes ou verifique a ortografia</p>
            </div>
        `;
        return;
    }
    
    const resultsHTML = results.map((result, index) => {
        const typeIcons = {
            item: '📦',
            session: '📋',
            user: '👤',
            category: '🏷️',
            scan: '🔍'
        };
        
        const typeColors = {
            item: 'text-blue-600',
            session: 'text-green-600',
            user: 'text-purple-600',
            category: 'text-orange-600',
            scan: 'text-gray-600'
        };
        
        return `
            <div class="search-result-item ${index === globalSearchState.selectedIndex ? 'selected' : ''}" 
                 data-index="${index}" onclick="selectSearchResultByIndex(${index})">
                <div class="flex items-start space-x-3">
                    <span class="text-2xl">${typeIcons[result.type]}</span>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                            <h3 class="font-medium text-gray-900 truncate">${highlightQuery(result.title, query)}</h3>
                            <span class="text-xs px-2 py-1 rounded-full bg-gray-100 ${typeColors[result.type]}">${result.type}</span>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">${highlightQuery(result.description, query)}</p>
                        ${result.stock !== undefined ? `<p class="text-xs text-gray-500 mt-1">Stock: ${result.stock}</p>` : ''}
                        ${result.success !== undefined ? `<span class="text-xs ${result.success ? 'text-green-600' : 'text-red-600'}">${result.success ? '✅ Sucesso' : '❌ Erro'}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    searchResultsList.innerHTML = resultsHTML;
}

function highlightQuery(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
}

function updateSelectedResult() {
    const resultItems = document.querySelectorAll('.search-result-item');
    
    resultItems.forEach((item, index) => {
        if (index === globalSearchState.selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function selectSearchResultByIndex(index) {
    if (globalSearchState.currentResults[index]) {
        selectSearchResult(globalSearchState.currentResults[index]);
    }
}

function selectSearchResult(result) {
    // Handle different result types
    switch (result.type) {
        case 'item':
            switchTab('items');
            showSuccessToast('Navegação', `Indo para artigo: ${result.title}`);
            break;
        case 'session':
            switchTab('sessions');
            showSuccessToast('Navegação', `Indo para sessão: ${result.title}`);
            break;
        case 'user':
            switchTab('users');
            showSuccessToast('Navegação', `Indo para utilizador: ${result.title}`);
            break;
        case 'category':
            switchTab('categories');
            showSuccessToast('Navegação', `Indo para categoria: ${result.title}`);
            break;
        case 'scan':
            switchTab('scanner');
            showSuccessToast('Navegação', `Indo para scanner - ${result.title}`);
            break;
        default:
            showSuccessToast('Resultado', `Selecionado: ${result.title}`);
    }
    
    closeGlobalSearch();
}

// ===================================
// 💭 SEARCH SUGGESTIONS
// ===================================

function initSearchSuggestions() {
    const suggestions = document.querySelectorAll('.search-suggestion');
    
    suggestions.forEach(suggestion => {
        suggestion.addEventListener('click', () => {
            const query = suggestion.getAttribute('data-suggestion');
            const searchInput = document.getElementById('globalSearchInput');
            
            if (searchInput && query) {
                searchInput.value = query;
                performSearch(query);
            }
        });
    });
}

function showSearchSuggestions() {
    const searchSuggestions = document.getElementById('searchSuggestions');
    const searchResults = document.getElementById('searchResults');
    
    if (searchSuggestions && searchResults) {
        searchSuggestions.classList.remove('hidden');
        searchResults.classList.add('hidden');
    }
}

// ===================================
// 📚 SEARCH HISTORY
// ===================================

function initSearchHistory() {
    const clearHistoryBtn = document.getElementById('clearSearchHistory');
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearSearchHistory);
    }
    
    renderSearchHistory();
}

function addToSearchHistory(query) {
    if (!query || query.length < 2) return;
    
    // Remove if already exists
    globalSearchState.searchHistory = globalSearchState.searchHistory.filter(
        item => item.query !== query
    );
    
    // Add to beginning
    globalSearchState.searchHistory.unshift({
        query: query,
        timestamp: Date.now(),
        filter: globalSearchState.currentFilter
    });
    
    // Keep only last 10
    if (globalSearchState.searchHistory.length > 10) {
        globalSearchState.searchHistory = globalSearchState.searchHistory.slice(0, 10);
    }
    
    // Save to localStorage
    localStorage.setItem('inventox_search_history', JSON.stringify(globalSearchState.searchHistory));
    
    renderSearchHistory();
}

function renderSearchHistory() {
    const searchHistoryList = document.getElementById('searchHistoryList');
    
    if (!searchHistoryList) return;
    
    if (globalSearchState.searchHistory.length === 0) {
        searchHistoryList.innerHTML = `
            <div class="text-center text-gray-400 py-4 text-sm">
                Nenhuma pesquisa recente
            </div>
        `;
        return;
    }
    
    const historyHTML = globalSearchState.searchHistory.map(item => {
        const time = new Date(item.timestamp).toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="search-history-item flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer" 
                 onclick="searchFromHistory('${item.query}', '${item.filter}')">
                <div class="flex items-center space-x-3">
                    <span class="text-gray-400">🕒</span>
                    <span class="text-sm">${item.query}</span>
                    <span class="text-xs text-gray-400">${getFilterName(item.filter)}</span>
                </div>
                <span class="text-xs text-gray-400">${time}</span>
            </div>
        `;
    }).join('');
    
    searchHistoryList.innerHTML = historyHTML;
}

function searchFromHistory(query, filter) {
    const searchInput = document.getElementById('globalSearchInput');
    
    if (searchInput) {
        searchInput.value = query;
        setSearchFilter(filter);
        performSearch(query);
    }
}

function clearSearchHistory() {
    if (confirm('Tem certeza que deseja limpar o histórico de pesquisas?')) {
        globalSearchState.searchHistory = [];
        localStorage.setItem('inventox_search_history', '[]');
        renderSearchHistory();
        showSuccessToast('Histórico Limpo', 'Histórico de pesquisas removido');
    }
}

// ===================================
// 🎤 VOICE SEARCH
// ===================================

function initVoiceSearch() {
    const voiceBtn = document.getElementById('voiceSearchBtn');
    const stopVoiceBtn = document.getElementById('stopVoiceSearch');
    
    if (voiceBtn) {
        voiceBtn.addEventListener('click', toggleVoiceSearch);
    }
    
    if (stopVoiceBtn) {
        stopVoiceBtn.addEventListener('click', stopVoiceSearch);
    }
    
    // Check if speech recognition is available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        globalSearchState.voiceRecognition = new SpeechRecognition();
        
        globalSearchState.voiceRecognition.continuous = false;
        globalSearchState.voiceRecognition.interimResults = false;
        globalSearchState.voiceRecognition.lang = 'pt-PT';
        
        globalSearchState.voiceRecognition.onresult = handleVoiceResult;
        globalSearchState.voiceRecognition.onerror = handleVoiceError;
        globalSearchState.voiceRecognition.onend = handleVoiceEnd;
    }
}

function toggleVoiceSearch() {
    if (globalSearchState.isVoiceActive) {
        stopVoiceSearch();
    } else {
        startVoiceSearch();
    }
}

function startVoiceSearch() {
    if (!globalSearchState.voiceRecognition) {
        showErrorToast('Voz Indisponível', 'Reconhecimento de voz não suportado neste navegador');
        return;
    }
    
    try {
        globalSearchState.voiceRecognition.start();
        globalSearchState.isVoiceActive = true;
        
        // Update UI
        const voiceBtn = document.getElementById('voiceSearchBtn');
        const voiceStatus = document.getElementById('voiceSearchStatus');
        
        if (voiceBtn) {
            voiceBtn.classList.add('voice-active', 'text-red-600');
        }
        
        if (voiceStatus) {
            voiceStatus.classList.remove('hidden');
        }
        
        showSuccessToast('Voz Ativa', 'Fale agora para pesquisar');
        
    } catch (error) {
        showErrorToast('Erro de Voz', 'Não foi possível iniciar o reconhecimento de voz');
        log.debug('Voice search error:', error);
    }
}

function stopVoiceSearch() {
    if (globalSearchState.voiceRecognition && globalSearchState.isVoiceActive) {
        globalSearchState.voiceRecognition.stop();
    }
    
    globalSearchState.isVoiceActive = false;
    
    // Update UI
    const voiceBtn = document.getElementById('voiceSearchBtn');
    const voiceStatus = document.getElementById('voiceSearchStatus');
    
    if (voiceBtn) {
        voiceBtn.classList.remove('voice-active', 'text-red-600');
    }
    
    if (voiceStatus) {
        voiceStatus.classList.add('hidden');
    }
}

function handleVoiceResult(event) {
    const transcript = event.results[0][0].transcript;
    const searchInput = document.getElementById('globalSearchInput');
    
    if (searchInput && transcript) {
        searchInput.value = transcript;
        performSearch(transcript);
        showSuccessToast('Voz Reconhecida', `Pesquisando por: "${transcript}"`);
    }
    
    stopVoiceSearch();
}

function handleVoiceError(event) {
    showErrorToast('Erro de Voz', 'Não foi possível reconhecer a fala');
    log.debug('Voice recognition error:', event.error);
    stopVoiceSearch();
}

function handleVoiceEnd() {
    stopVoiceSearch();
}

// ===================================
// ⌨️ KEYBOARD SHORTCUTS INTEGRATION
// ===================================

function initKeyboardShortcuts() {
    // Override the existing Ctrl+K handler
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            openGlobalSearch();
        }
    });
}

// Make functions available globally
window.selectSearchResultByIndex = selectSearchResultByIndex;
window.searchFromHistory = searchFromHistory;

// ===================================
// 🎯 INITIALIZE GLOBAL SEARCH
// ===================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initGlobalSearch, 100);
});

// ===================================
// 📊 ADVANCED ANALYTICS SYSTEM - FASE 5
// ===================================

// Analytics State
let analyticsState = {
    timeRange: 30,
    currentPeriod: 'daily',
    data: {
        kpis: {
            totalScans: 0,
            productivity: 0,
            accuracy: 0,
            efficiency: 0
        },
        trends: [],
        heatmap: [],
        categories: [],
        users: [],
        insights: [],
        recommendations: []
    },
    updateInterval: null,
    isRealTimeEnabled: true
};

// Initialize Advanced Analytics
function initAdvancedAnalytics() {
    initAnalyticsControls();
    initChartInteractions();
    initReportsSystem();
    initInsightsEngine();
    loadAnalyticsData();
    
    if (analyticsState.isRealTimeEnabled) {
        startRealTimeUpdates();
    }
    
    log.debug('Advanced Analytics initialized');
}

// ===================================
// 🎛️ ANALYTICS CONTROLS
// ===================================

function initAnalyticsControls() {
    const timeRangeSelect = document.getElementById('analyticsTimeRange');
    const refreshBtn = document.getElementById('refreshAnalytics');
    const exportBtn = document.getElementById('exportAnalytics');
    
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', (e) => {
            analyticsState.timeRange = parseInt(e.target.value);
            loadAnalyticsData();
            showSuccessToast('Período Atualizado', `Mostrando dados dos últimos ${analyticsState.timeRange} dias`);
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAnalyticsData();
            showSuccessToast('Dados Atualizados', 'Análise atualizada com sucesso');
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAnalyticsData);
    }
    
    // Chart period buttons
    const periodButtons = document.querySelectorAll('.chart-period');
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            const period = button.getAttribute('data-period');
            setChartPeriod(period);
        });
    });
}

function setChartPeriod(period) {
    analyticsState.currentPeriod = period;
    
    // Update UI
    const periodButtons = document.querySelectorAll('.chart-period');
    periodButtons.forEach(button => {
        if (button.getAttribute('data-period') === period) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Update chart
    updateActivityTrendChart();
    
    const periodNames = {
        'daily': 'Diário',
        'weekly': 'Semanal',
        'monthly': 'Mensal'
    };
    
    showSuccessToast('Vista Alterada', `Mostrando dados ${periodNames[period].toLowerCase()}`);
}

// ===================================
// 📈 DATA LOADING AND PROCESSING
// ===================================

async function loadAnalyticsData() {
    try {
        showEnhancedLoading('Carregando Análise...', 'Processando dados em tempo real');
        
        // Fetch real data from API
        analyticsState.data = await fetchAnalyticsFromAPI();
        
        // Update all components
        updateKPIs();
        updateActivityTrendChart();
        updatePerformanceHeatmap();
        updateCategoryDistribution();
        updateUserRanking();
        updateInsightsAndRecommendations();
        
        hideEnhancedLoading();
        
    } catch (error) {
        hideEnhancedLoading();
        showErrorToast('Erro de Análise', 'Não foi possível carregar os dados');
        log.debug('Analytics loading error:', error);
        
        // Fallback to mock data if API fails
        try {
            analyticsState.data = await generateMockAnalyticsData();
            updateKPIs();
            updateActivityTrendChart();
            updatePerformanceHeatmap();
            updateCategoryDistribution();
            updateUserRanking();
            updateInsightsAndRecommendations();
            showSuccessToast('Dados Simulados', 'Usando dados de exemplo (API indisponível)');
        } catch (fallbackError) {
            log.debug('Fallback data generation failed:', fallbackError);
        }
    }
}

async function fetchAnalyticsFromAPI() {
    try {
        const response = await fetch(`${API_BASE}/analytics.php?timeRange=${analyticsState.timeRange}&period=${analyticsState.currentPeriod}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Erro na resposta da API');
        }
        
        // Transform API data to match frontend format
        const apiData = result.data;
        
        return {
            kpis: {
                totalScans: apiData.kpis.totalScans,
                productivity: apiData.kpis.productivity,
                accuracy: apiData.kpis.accuracy,
                efficiency: apiData.kpis.efficiency,
                activeSessions: apiData.kpis.activeSessions,
                changes: apiData.kpis.changes
            },
            trends: apiData.trends.map(trend => ({
                date: new Date(trend.date),
                scans: trend.scans,
                accuracy: trend.accuracy,
                efficiency: trend.efficiency
            })),
            heatmap: apiData.heatmap.map(cell => ({
                week: cell.week,
                day: cell.day,
                date: new Date(cell.date),
                scans: cell.scans,
                value: cell.value
            })),
            categories: apiData.categories,
            users: apiData.users,
            insights: apiData.insights,
            recommendations: apiData.recommendations
        };
        
    } catch (error) {
        log.debug('API fetch error:', error);
        throw error;
    }
}

async function generateMockAnalyticsData() {
    const scanHistory = JSON.parse(localStorage.getItem('inventox_scan_history') || '[]');
    const scanCount = parseInt(localStorage.getItem('inventox_scan_count_today') || '0');
    
    // Calculate real metrics from scan history
    const now = new Date();
    const timeRangeMs = analyticsState.timeRange * 24 * 60 * 60 * 1000;
    const startDate = new Date(now.getTime() - timeRangeMs);
    
    const relevantScans = scanHistory.filter(scan => 
        new Date(scan.timestamp) >= startDate
    );
    
    // Generate KPIs
    const totalScans = relevantScans.length || Math.floor(Math.random() * 1000) + 500;
    const successfulScans = relevantScans.filter(scan => scan.success).length;
    const accuracy = relevantScans.length > 0 ? 
        Math.round((successfulScans / relevantScans.length) * 100) : 
        Math.floor(Math.random() * 20) + 80;
    
    const productivity = Math.floor(Math.random() * 30) + 70;
    const efficiency = Math.floor(Math.random() * 25) + 75;
    
    // Generate trend data
    const trends = [];
    for (let i = analyticsState.timeRange - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dayScans = Math.floor(Math.random() * 50) + 10;
        trends.push({
            date: date,
            scans: dayScans,
            accuracy: Math.floor(Math.random() * 20) + 80,
            efficiency: Math.floor(Math.random() * 30) + 70
        });
    }
    
    // Generate heatmap data (7x7 grid for last 7 weeks)
    const heatmap = [];
    for (let week = 0; week < 7; week++) {
        for (let day = 0; day < 7; day++) {
            heatmap.push({
                week: week,
                day: day,
                value: Math.floor(Math.random() * 5),
                scans: Math.floor(Math.random() * 100),
                date: new Date(now.getTime() - ((week * 7 + day) * 24 * 60 * 60 * 1000))
            });
        }
    }
    
    // Generate category data
    const categories = [
        { name: 'Eletrónicos', count: Math.floor(Math.random() * 200) + 100, percentage: 0 },
        { name: 'Vestuário', count: Math.floor(Math.random() * 150) + 80, percentage: 0 },
        { name: 'Casa & Jardim', count: Math.floor(Math.random() * 120) + 60, percentage: 0 },
        { name: 'Desporto', count: Math.floor(Math.random() * 80) + 40, percentage: 0 },
        { name: 'Livros', count: Math.floor(Math.random() * 50) + 20, percentage: 0 }
    ];
    
    // Calculate percentages
    const totalCategoryCount = categories.reduce((sum, cat) => sum + cat.count, 0);
    categories.forEach(cat => {
        cat.percentage = Math.round((cat.count / totalCategoryCount) * 100);
    });
    
    // Generate user data
    const users = [
        { name: 'João Silva', role: 'Operador', scans: Math.floor(Math.random() * 500) + 800, accuracy: Math.floor(Math.random() * 10) + 90, speed: Math.floor(Math.random() * 20) + 80 },
        { name: 'Maria Santos', role: 'Administrador', scans: Math.floor(Math.random() * 400) + 600, accuracy: Math.floor(Math.random() * 8) + 92, speed: Math.floor(Math.random() * 15) + 85 },
        { name: 'Pedro Costa', role: 'Operador', scans: Math.floor(Math.random() * 300) + 400, accuracy: Math.floor(Math.random() * 12) + 88, speed: Math.floor(Math.random() * 25) + 75 },
        { name: 'Ana Ferreira', role: 'Operador', scans: Math.floor(Math.random() * 250) + 300, accuracy: Math.floor(Math.random() * 15) + 85, speed: Math.floor(Math.random() * 30) + 70 }
    ];
    
    // Sort users by selected metric
    users.sort((a, b) => b.scans - a.scans);
    
    return {
        kpis: {
            totalScans: totalScans,
            productivity: productivity,
            accuracy: accuracy,
            efficiency: efficiency,
            changes: {
                scans: Math.floor(Math.random() * 20) + 5,
                productivity: Math.floor(Math.random() * 15) + 3,
                accuracy: Math.floor(Math.random() * 8) + 2,
                efficiency: Math.floor(Math.random() * 12) + 4
            }
        },
        trends: trends,
        heatmap: heatmap,
        categories: categories,
        users: users
    };
}

// ===================================
// 📊 KPI UPDATES
// ===================================

function updateKPIs() {
    const kpis = analyticsState.data.kpis;
    
    // Update values with animation
    animateValue('kpiTotalScans', 0, kpis.totalScans, 1000);
    animateValue('kpiProductivity', 0, kpis.productivity, 1200);
    animateValue('kpiAccuracy', 0, kpis.accuracy, 1400, '%');
    animateValue('kpiEfficiency', 0, kpis.efficiency, 1600, '%');
    
    // Update change indicators
    setTimeout(() => {
        updateChangeIndicator('kpiScansChange', kpis.changes.scans);
        updateChangeIndicator('kpiProductivityChange', kpis.changes.productivity);
        updateChangeIndicator('kpiAccuracyChange', kpis.changes.accuracy);
        updateChangeIndicator('kpiEfficiencyChange', kpis.changes.efficiency);
    }, 1800);
}

function animateValue(elementId, start, end, duration, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current) + suffix;
    }, 16);
}

function updateChangeIndicator(elementId, change) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const isPositive = change > 0;
    element.textContent = `${isPositive ? '+' : ''}${change}%`;
    element.className = `text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`;
}

// ===================================
// 📈 CHART UPDATES
// ===================================

function updateActivityTrendChart() {
    const chartContainer = document.getElementById('activityTrendChart');
    if (!chartContainer) return;
    
    const trends = analyticsState.data.trends;
    const maxValue = Math.max(...trends.map(t => t.scans));
    
    // Clear existing bars
    chartContainer.innerHTML = '';
    
    // Create new bars
    trends.forEach((trend, index) => {
        const bar = document.createElement('div');
        const height = (trend.scans / maxValue) * 100;
        
        bar.className = 'bg-blue-500 rounded-t transition-all duration-500 chart-bar cursor-pointer';
        bar.style.height = height + '%';
        bar.style.width = '8%';
        bar.title = `${trend.date.toLocaleDateString('pt-PT')}: ${trend.scans} scans`;
        
        // Add hover effect
        bar.addEventListener('mouseenter', () => {
            showTooltip(bar, `${trend.scans} scans`, trend.date.toLocaleDateString('pt-PT'));
        });
        
        bar.addEventListener('mouseleave', hideTooltip);
        
        chartContainer.appendChild(bar);
        
        // Animate bar appearance
        setTimeout(() => {
            bar.style.height = height + '%';
        }, index * 50);
    });
}

function updatePerformanceHeatmap() {
    const heatmapContainer = document.getElementById('performanceHeatmap');
    if (!heatmapContainer) return;
    
    const heatmapData = analyticsState.data.heatmap;
    
    // Clear existing cells
    heatmapContainer.innerHTML = '';
    
    // Create heatmap cells
    heatmapData.forEach(cell => {
        const cellElement = document.createElement('div');
        const intensity = cell.value;
        
        const colors = [
            'bg-gray-200',
            'bg-green-200',
            'bg-green-300',
            'bg-green-500',
            'bg-green-700'
        ];
        
        cellElement.className = `heatmap-cell ${colors[intensity]}`;
        cellElement.title = `${cell.date.toLocaleDateString('pt-PT')}: ${cell.scans} scans`;
        
        cellElement.addEventListener('click', () => {
            showSuccessToast('Detalhes do Dia', `${cell.date.toLocaleDateString('pt-PT')}: ${cell.scans} scans`);
        });
        
        heatmapContainer.appendChild(cellElement);
    });
}

function updateCategoryDistribution() {
    const categories = analyticsState.data.categories;
    const legendContainer = document.getElementById('categoryLegend');
    
    if (!legendContainer) return;
    
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500'];
    
    legendContainer.innerHTML = categories.map((category, index) => `
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
                <div class="w-3 h-3 ${colors[index]} rounded"></div>
                <span class="text-sm">${category.name}</span>
            </div>
            <span class="text-sm font-semibold">${category.percentage}%</span>
        </div>
    `).join('');
}

function updateUserRanking() {
    const users = analyticsState.data.users;
    const rankingContainer = document.getElementById('userRankingList');
    
    if (!rankingContainer) return;
    
    const rankColors = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-500', 'bg-blue-500'];
    const rankBgColors = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-orange-50 border-orange-200', 'bg-blue-50 border-blue-200'];
    const rankTextColors = ['text-yellow-600', 'text-gray-600', 'text-orange-600', 'text-blue-600'];
    
    rankingContainer.innerHTML = users.map((user, index) => `
        <div class="flex items-center justify-between p-3 ${rankBgColors[index]} border rounded">
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 ${rankColors[index]} text-white rounded-full flex items-center justify-center font-bold text-sm">${index + 1}</div>
                <div>
                    <div class="font-semibold">${user.name}</div>
                    <div class="text-xs text-gray-500">${user.role}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="font-bold ${rankTextColors[index]}">${user.scans.toLocaleString()}</div>
                <div class="text-xs text-gray-500">scans</div>
            </div>
        </div>
    `).join('');
}

// ===================================
// 🎯 CHART INTERACTIONS
// ===================================

function initChartInteractions() {
    // Category chart type toggle
    const categoryToggle = document.getElementById('categoryChartType');
    if (categoryToggle) {
        categoryToggle.addEventListener('click', toggleCategoryChartType);
    }
    
    // Ranking metric selector
    const rankingMetric = document.getElementById('rankingMetric');
    if (rankingMetric) {
        rankingMetric.addEventListener('change', updateRankingMetric);
    }
    
    // Heatmap settings
    const heatmapSettings = document.getElementById('heatmapSettings');
    if (heatmapSettings) {
        heatmapSettings.addEventListener('click', showHeatmapSettings);
    }
}

function toggleCategoryChartType() {
    // This would toggle between donut and bar chart
    showSuccessToast('Vista Alterada', 'Alternando entre gráfico circular e barras');
}

function updateRankingMetric(event) {
    const metric = event.target.value;
    const users = analyticsState.data.users;
    
    // Sort users by selected metric
    users.sort((a, b) => {
        switch (metric) {
            case 'accuracy':
                return b.accuracy - a.accuracy;
            case 'speed':
                return b.speed - a.speed;
            case 'efficiency':
                return (b.accuracy * b.speed) - (a.accuracy * a.speed);
            default:
                return b.scans - a.scans;
        }
    });
    
    updateUserRanking();
    
    const metricNames = {
        'scans': 'Total de Scans',
        'accuracy': 'Precisão',
        'speed': 'Velocidade',
        'efficiency': 'Eficiência'
    };
    
    showSuccessToast('Ranking Atualizado', `Ordenado por ${metricNames[metric]}`);
}

function showHeatmapSettings() {
    showSuccessToast('Configurações', 'Configurações do mapa de calor em breve');
}

// ===================================
// 📋 REPORTS SYSTEM
// ===================================

function initReportsSystem() {
    const createReportBtn = document.getElementById('createCustomReport');
    if (createReportBtn) {
        createReportBtn.addEventListener('click', showCreateReportModal);
    }
    
    // Report cards
    const reportCards = document.querySelectorAll('.report-card');
    reportCards.forEach(card => {
        card.addEventListener('click', () => {
            const reportType = card.querySelector('h4').textContent;
            generateReport(reportType);
        });
    });
}

function generateReport(reportType) {
    showEnhancedLoading('Gerando Relatório...', `Criando ${reportType}`);
    
    setTimeout(() => {
        hideEnhancedLoading();
        showSuccessToast('Relatório Gerado', `${reportType} criado com sucesso`);
        
        // Simulate report download
        const blob = new Blob([`Relatório: ${reportType}\nGerado em: ${new Date().toLocaleString('pt-PT')}\n\nDados simulados...`], 
            { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 2000);
}

function showCreateReportModal() {
    showSuccessToast('Criação de Relatório', 'Modal de criação personalizada em breve');
}

// ===================================
// 💡 INSIGHTS ENGINE
// ===================================

function initInsightsEngine() {
    generateInsights();
    generateRecommendations();
}

function generateInsights() {
    // This would typically use AI/ML to generate insights
    const insights = [
        {
            type: 'productivity',
            title: 'Pico de Produtividade',
            message: 'A produtividade aumenta 23% entre as 10h-12h. Considere agendar tarefas críticas neste período.',
            color: 'blue',
            icon: '🎯'
        },
        {
            type: 'trend',
            title: 'Tendência Positiva',
            message: 'Precisão dos scans melhorou 15% na última semana. Excelente progresso da equipe!',
            color: 'green',
            icon: '📈'
        },
        {
            type: 'warning',
            title: 'Atenção Necessária',
            message: 'Categoria "Eletrónicos" apresenta 8% mais erros. Revisar processo de digitalização.',
            color: 'yellow',
            icon: '⚠️'
        }
    ];
    
    analyticsState.data.insights = insights;
}

function generateRecommendations() {
    const recommendations = [
        {
            type: 'optimization',
            title: 'Otimização Sugerida',
            message: 'Implementar pausas de 5min a cada hora pode aumentar a produtividade em 12%.',
            color: 'purple',
            icon: '🚀',
            actions: ['Aplicar', 'Mais info']
        },
        {
            type: 'training',
            title: 'Formação Recomendada',
            message: 'Treino adicional em "Códigos de Barras Danificados" pode reduzir erros em 20%.',
            color: 'indigo',
            icon: '🎓',
            actions: ['Agendar', 'Ver curso']
        },
        {
            type: 'system',
            title: 'Melhoria de Sistema',
            message: 'Atualizar scanner para modelo XYZ pode aumentar velocidade em 30%.',
            color: 'teal',
            icon: '🔧',
            actions: ['Orçamento', 'Especificações']
        }
    ];
    
    analyticsState.data.recommendations = recommendations;
}

function updateInsightsAndRecommendations() {
    updateInsightsSection();
    updateRecommendationsSection();
    log.debug('Insights and recommendations updated');
}

function updateInsightsSection() {
    const insightsContainer = document.getElementById('aiInsights');
    if (!insightsContainer || !analyticsState.data.insights) return;
    
    const insights = analyticsState.data.insights;
    
    if (insights.length === 0) {
        insightsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <div class="text-4xl mb-2">💡</div>
                <p class="text-sm">Nenhum insight disponível</p>
                <p class="text-xs text-gray-400">Os insights aparecerão com mais dados</p>
            </div>
        `;
        return;
    }
    
    const insightsHTML = insights.map(insight => {
        const colorClasses = {
            blue: 'bg-blue-50 border-blue-200 text-blue-800',
            green: 'bg-green-50 border-green-200 text-green-800',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            red: 'bg-red-50 border-red-200 text-red-800'
        };
        
        const iconBgColors = {
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            yellow: 'bg-yellow-500',
            red: 'bg-red-500'
        };
        
        return `
            <div class="insight-card p-4 ${colorClasses[insight.color]} border rounded-lg">
                <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 ${iconBgColors[insight.color]} rounded-full flex items-center justify-center flex-shrink-0">
                        <span class="text-white text-sm">${insight.icon}</span>
                    </div>
                    <div>
                        <h4 class="font-semibold mb-1">${insight.title}</h4>
                        <p class="text-sm opacity-90">${insight.message}</p>
                        <button class="text-xs hover:underline mt-2">Ver detalhes →</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    insightsContainer.innerHTML = insightsHTML;
}

function updateRecommendationsSection() {
    const recommendationsContainer = document.getElementById('aiRecommendations');
    if (!recommendationsContainer || !analyticsState.data.recommendations) return;
    
    const recommendations = analyticsState.data.recommendations;
    
    if (recommendations.length === 0) {
        recommendationsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <div class="text-4xl mb-2">🚀</div>
                <p class="text-sm">Nenhuma recomendação disponível</p>
                <p class="text-xs text-gray-400">As recomendações aparecerão com mais dados</p>
            </div>
        `;
        return;
    }
    
    const recommendationsHTML = recommendations.map(rec => {
        const colorClasses = {
            purple: 'bg-purple-50 border-purple-200 text-purple-800',
            indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
            teal: 'bg-teal-50 border-teal-200 text-teal-800',
            orange: 'bg-orange-50 border-orange-200 text-orange-800'
        };
        
        const iconBgColors = {
            purple: 'bg-purple-500',
            indigo: 'bg-indigo-500',
            teal: 'bg-teal-500',
            orange: 'bg-orange-500'
        };
        
        const buttonColors = {
            purple: 'bg-purple-600 hover:bg-purple-700',
            indigo: 'bg-indigo-600 hover:bg-indigo-700',
            teal: 'bg-teal-600 hover:bg-teal-700',
            orange: 'bg-orange-600 hover:bg-orange-700'
        };
        
        const textColors = {
            purple: 'text-purple-600 hover:text-purple-800',
            indigo: 'text-indigo-600 hover:text-indigo-800',
            teal: 'text-teal-600 hover:text-teal-800',
            orange: 'text-orange-600 hover:text-orange-800'
        };
        
        const actionsHTML = rec.actions ? rec.actions.map(action => `
            <button class="text-xs ${buttonColors[rec.color]} text-white px-2 py-1 rounded">${action}</button>
        `).join('') : '';
        
        return `
            <div class="recommendation-card p-4 ${colorClasses[rec.color]} border rounded-lg">
                <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 ${iconBgColors[rec.color]} rounded-full flex items-center justify-center flex-shrink-0">
                        <span class="text-white text-sm">${rec.icon}</span>
                    </div>
                    <div>
                        <h4 class="font-semibold mb-1">${rec.title}</h4>
                        <p class="text-sm opacity-90">${rec.message}</p>
                        <div class="flex items-center space-x-2 mt-2">
                            ${actionsHTML}
                            <button class="text-xs ${textColors[rec.color]}">Mais info</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    recommendationsContainer.innerHTML = recommendationsHTML;
}

// ===================================
// 📤 DATA EXPORT
// ===================================

async function exportAnalyticsData() {
    try {
        showEnhancedLoading('Exportando Dados...', 'Preparando relatório completo');
        
        // Simulate export preparation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const exportData = {
            timestamp: new Date().toISOString(),
            timeRange: analyticsState.timeRange,
            period: analyticsState.currentPeriod,
            kpis: analyticsState.data.kpis,
            summary: {
                totalScans: analyticsState.data.kpis.totalScans,
                accuracy: analyticsState.data.kpis.accuracy,
                productivity: analyticsState.data.kpis.productivity,
                efficiency: analyticsState.data.kpis.efficiency,
                activeSessions: analyticsState.data.kpis.activeSessions,
                topUser: analyticsState.data.users[0]?.name || 'N/A',
                topCategory: analyticsState.data.categories[0]?.name || 'N/A',
                totalCategories: analyticsState.data.categories.length,
                totalUsers: analyticsState.data.users.length
            },
            insights: analyticsState.data.insights.length,
            recommendations: analyticsState.data.recommendations.length,
            trendsCount: analyticsState.data.trends.length
        };
        
        // Create CSV content
        const csvContent = generateCSVExport(exportData);
        
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventox_analytics_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideEnhancedLoading();
        showSuccessToast('Exportação Concluída', 'Dados exportados com sucesso');
        
    } catch (error) {
        hideEnhancedLoading();
        showErrorToast('Erro na Exportação', 'Não foi possível exportar os dados');
        log.debug('Export error:', error);
    }
}

function generateCSVExport(data) {
    const headers = ['Métrica', 'Valor', 'Alteração'];
    const rows = [
        ['=== INVENTOX ANALYTICS REPORT ===', '', ''],
        ['Gerado em', new Date().toLocaleString('pt-PT'), ''],
        ['Período de Análise', `${data.timeRange} dias`, ''],
        ['Visualização', data.period, ''],
        ['', '', ''],
        ['=== KPIs PRINCIPAIS ===', '', ''],
        ['Total de Scans', data.kpis.totalScans, `${data.kpis.changes.scans >= 0 ? '+' : ''}${data.kpis.changes.scans}%`],
        ['Produtividade (scans/dia)', data.kpis.productivity, `${data.kpis.changes.productivity >= 0 ? '+' : ''}${data.kpis.changes.productivity}%`],
        ['Precisão', `${data.kpis.accuracy}%`, `${data.kpis.changes.accuracy >= 0 ? '+' : ''}${data.kpis.changes.accuracy}%`],
        ['Eficiência', `${data.kpis.efficiency}%`, `${data.kpis.changes.efficiency >= 0 ? '+' : ''}${data.kpis.changes.efficiency}%`],
        ['Sessões Ativas', data.kpis.activeSessions, ''],
        ['', '', ''],
        ['=== RESUMO EXECUTIVO ===', '', ''],
        ['Utilizador Top Performance', data.summary.topUser, ''],
        ['Categoria Mais Scaneada', data.summary.topCategory, ''],
        ['Total de Categorias', data.summary.totalCategories, ''],
        ['Total de Utilizadores Ativos', data.summary.totalUsers, ''],
        ['Pontos de Dados Analisados', data.trendsCount, ''],
        ['', '', ''],
        ['=== ANÁLISE INTELIGENTE ===', '', ''],
        ['Insights Gerados', data.insights, ''],
        ['Recomendações Disponíveis', data.recommendations, ''],
        ['', '', ''],
        ['=== CATEGORIAS ===', '', '']
    ];
    
    // Add category data if available
    if (analyticsState.data.categories && analyticsState.data.categories.length > 0) {
        analyticsState.data.categories.forEach(category => {
            rows.push([category.name, `${category.count} scans`, `${category.percentage}%`]);
        });
    }
    
    rows.push(['', '', '']);
    rows.push(['=== UTILIZADORES ===', '', '']);
    
    // Add user data if available
    if (analyticsState.data.users && analyticsState.data.users.length > 0) {
        analyticsState.data.users.forEach((user, index) => {
            rows.push([
                `${index + 1}º ${user.name}`, 
                `${user.scans} scans`, 
                `${user.accuracy}% precisão`
            ]);
        });
    }
    
    rows.push(['', '', '']);
    rows.push(['=== INSIGHTS ===', '', '']);
    
    // Add insights if available
    if (analyticsState.data.insights && analyticsState.data.insights.length > 0) {
        analyticsState.data.insights.forEach(insight => {
            rows.push([insight.title, insight.message, insight.type]);
        });
    }
    
    rows.push(['', '', '']);
    rows.push(['=== RECOMENDAÇÕES ===', '', '']);
    
    // Add recommendations if available
    if (analyticsState.data.recommendations && analyticsState.data.recommendations.length > 0) {
        analyticsState.data.recommendations.forEach(rec => {
            rows.push([rec.title, rec.message, rec.type]);
        });
    }
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    return csvContent;
}

// ===================================
// ⏱️ REAL-TIME UPDATES
// ===================================

function startRealTimeUpdates() {
    // Update every 5 minutes
    analyticsState.updateInterval = setInterval(() => {
        if (document.getElementById('analyticsTab') && !document.getElementById('analyticsTab').classList.contains('hidden')) {
            loadAnalyticsData();
        }
    }, 5 * 60 * 1000);
}

function stopRealTimeUpdates() {
    if (analyticsState.updateInterval) {
        clearInterval(analyticsState.updateInterval);
        analyticsState.updateInterval = null;
    }
}

// ===================================
// 🛠️ UTILITY FUNCTIONS
// ===================================

function showTooltip(element, title, subtitle) {
    // Simple tooltip implementation
    const tooltip = document.createElement('div');
    tooltip.className = 'absolute bg-black text-white text-xs rounded px-2 py-1 z-50';
    tooltip.innerHTML = `<div>${title}</div><div class="text-gray-300">${subtitle}</div>`;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top - 60) + 'px';
    
    document.body.appendChild(tooltip);
    
    element._tooltip = tooltip;
}

function hideTooltip(event) {
    if (event.target._tooltip) {
        document.body.removeChild(event.target._tooltip);
        delete event.target._tooltip;
    }
}

// ===================================
// 🎯 INITIALIZE ADVANCED ANALYTICS
// ===================================

// Initialize when analytics tab becomes active
const originalSwitchTabAnalytics = window.switchTab;
if (originalSwitchTabAnalytics) {
    const enhancedSwitchTabAnalytics = window.switchTab;
    window.switchTab = function(tabName) {
        enhancedSwitchTabAnalytics(tabName);
        // Analytics disabled
        // if (tabName === 'analytics') {
        //     setTimeout(initAdvancedAnalytics, 100);
        // } else 
        if (tabName === 'scanner') {
            setTimeout(initEnhancedScanner, 100);
        } else if (tabName === 'dashboard') {
            setTimeout(initInteractiveDashboard, 100);
        }
    };
}

// Initialize when DOM is ready
// Analytics disabled
// document.addEventListener('DOMContentLoaded', () => {
//     setTimeout(() => {
//         if (document.getElementById('analyticsTab') && !document.getElementById('analyticsTab').classList.contains('hidden')) {
//             initAdvancedAnalytics();
//         }
//     }, 400);
// });

