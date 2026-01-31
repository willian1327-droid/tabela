// =====================================================
// GERMINA - Sistema de Tabela de Preços
// app.js - Lógica principal
// =====================================================

import { SUPABASE_CONFIG } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Inicializar Supabase
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Estado global
let currentUser = null;
let currentTab = 'importar';
let deleteCallback = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================
window.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
});

// =====================================================
// AUTENTICAÇÃO
// =====================================================
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        showLogin();
        return;
    }
    
    currentUser = session.user;
    
    // Verificar se é admin
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .single();
    
    if (!roleData || roleData.role !== 'admin') {
        alert('Acesso negado! Apenas administradores.');
        await supabase.auth.signOut();
        showLogin();
        return;
    }
    
    showDashboard();
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('userEmail').textContent = currentUser.email;
    
    loadTaxSettings();
    loadAllData();
}

// Login form
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btnLogin = document.getElementById('btnLogin');
    const errorMessage = document.getElementById('errorMessage');
    
    btnLogin.disabled = true;
    document.getElementById('btnLoginText').style.display = 'none';
    document.getElementById('btnLoginLoading').style.display = 'inline';
    errorMessage.style.display = 'none';
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await checkAuth();
        
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
        btnLogin.disabled = false;
        document.getElementById('btnLoginText').style.display = 'inline';
        document.getElementById('btnLoginLoading').style.display = 'none';
    }
});

window.logout = async function() {
    await supabase.auth.signOut();
    location.reload();
};

// =====================================================
// NAVEGAÇÃO ENTRE ABAS
// =====================================================
window.switchTab = function(tabName) {
    currentTab = tabName;
    
    // Atualizar botões
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Carregar dados específicos da aba
    loadTabData(tabName);
};

window.switchSubTab = function(subTabName) {
    document.querySelectorAll('.sub-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.querySelectorAll('.subtab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`subtab-${subTabName}`).classList.add('active');
};

async function loadTabData(tabName) {
    switch(tabName) {
        case 'importar':
            await loadCategoriesForImport();
            break;
        case 'categorias':
            await loadCategories();
            break;
        case 'produtos':
            await loadProducts();
            break;
        case 'estoque':
            await loadStockCategories();
            break;
        case 'avisos':
            await loadAnnouncements();
            break;
        case 'usuarios':
            await loadUsers();
            break;
    }
}

async function loadAllData() {
    await loadTabData(currentTab);
}

// =====================================================
// CONFIGURAÇÕES (TRIBUTAÇÃO)
// =====================================================
async function loadTaxSettings() {
    const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['tax_name', 'tax_percentage']);
    
    if (settings) {
        const taxName = settings.find(s => s.key === 'tax_name')?.value || 'Tributação';
        const taxPercentage = settings.find(s => s.key === 'tax_percentage')?.value || '5';
        
        document.getElementById('taxName').textContent = taxName;
        document.getElementById('taxValue').textContent = `${taxPercentage}% ${taxName}`;
    }
}

// =====================================================
// CATEGORIAS
// =====================================================
async function loadCategories() {
    const { data: categories, error } = await supabase
        .from('categories')
        .select(`
            *,
            products(count)
        `)
        .order('name');
    
    if (error) {
        console.error('Erro ao carregar categorias:', error);
        return;
    }
    
    displayCategories(categories);
}

function displayCategories(categories) {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';
    
    if (categories.length === 0) {
        grid.innerHTML = '<p>Nenhuma categoria cadastrada.</p>';
        return;
    }
    
    categories.forEach(category => {
        const productCount = category.products?.[0]?.count || 0;
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-card-header">
                <div>
                    <h4>${category.name}</h4>
                    <p class="category-count">${productCount} produtos</p>
                </div>
                <div class="category-actions">
                    <button onclick="editCategory('${category.id}')" class="action-btn" title="Editar">✏️</button>
                    <button onclick="deleteCategory('${category.id}', '${category.name}')" class="action-btn" title="Excluir">🗑️</button>
                </div>
            </div>
            <div class="category-units">
                ${(category.units || []).map(unit => `<span class="unit-badge">${unit}</span>`).join('')}
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadCategoriesForImport() {
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('name');
    
    const selects = ['importCategory', 'stockCategory', 'productCategory'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Selecione uma categoria...</option>';
            categories?.forEach(cat => {
                select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
            });
        }
    });
}

window.openNewCategoryModal = function() {
    document.getElementById('categoryModalTitle').textContent = 'Nova Categoria';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    openModal('categoryModal');
};

window.editCategory = async function(categoryId) {
    const { data: category } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .single();
    
    if (category) {
        document.getElementById('categoryModalTitle').textContent = 'Editar Categoria';
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryName').value = category.name;
        
        // Marcar unidades
        document.querySelectorAll('#categoryForm input[type="checkbox"]').forEach(cb => {
            cb.checked = category.units?.includes(cb.value);
        });
        
        openModal('categoryModal');
    }
};

window.saveCategory = async function(event) {
    event.preventDefault();
    
    const categoryId = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value;
    const units = Array.from(document.querySelectorAll('#categoryForm input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    const categoryData = { name, units };
    
    try {
        if (categoryId) {
            const { error } = await supabase
                .from('categories')
                .update(categoryData)
                .eq('id', categoryId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('categories')
                .insert([categoryData]);
            if (error) throw error;
        }
        
        alert(categoryId ? 'Categoria atualizada!' : 'Categoria criada!');
        closeCategoryModal();
        await loadCategories();
        await loadCategoriesForImport();
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

window.deleteCategory = function(categoryId, categoryName) {
    openDeleteModal(categoryName, async () => {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', categoryId);
        
        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            alert('Categoria excluída!');
            await loadCategories();
            await loadCategoriesForImport();
        }
    });
};

window.closeCategoryModal = function() {
    closeModal('categoryModal');
};

// =====================================================
// PRODUTOS
// =====================================================
async function loadProducts() {
    const { data: products, error } = await supabase
        .from('products')
        .select(`
            *,
            category:categories(name)
        `)
        .order('category_id')
        .order('name');
    
    if (error) {
        console.error('Erro ao carregar produtos:', error);
        return;
    }
    
    displayProducts(products);
}

function displayProducts(products) {
    const section = document.getElementById('productsSection');
    document.getElementById('productsCount').textContent = `${products.length} produtos cadastrados`;
    
    // Agrupar por categoria
    const grouped = products.reduce((acc, product) => {
        const categoryName = product.category?.name || 'Sem Categoria';
        if (!acc[categoryName]) acc[categoryName] = [];
        acc[categoryName].push(product);
        return acc;
    }, {});
    
    section.innerHTML = '';
    
    Object.entries(grouped).forEach(([categoryName, categoryProducts]) => {
        const categorySection = document.createElement('div');
        categorySection.className = 'products-category-section';
        categorySection.innerHTML = `
            <div class="products-category-header" onclick="toggleCategoryProducts(this)">
                <h4>📂 ${categoryName} (${categoryProducts.length} produtos)</h4>
                <span>▼</span>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Preço</th>
                        <th>Unidade</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${categoryProducts.map(product => `
                        <tr>
                            <td>${product.name}</td>
                            <td>R$ ${parseFloat(product.price).toFixed(2)}</td>
                            <td>${product.unit}</td>
                            <td>
                                <button onclick="editProduct('${product.id}')" class="action-btn">✏️</button>
                                <button onclick="deleteProduct('${product.id}', '${product.name}')" class="action-btn">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        section.appendChild(categorySection);
    });
}

window.toggleCategoryProducts = function(header) {
    const table = header.nextElementSibling;
    const arrow = header.querySelector('span');
    
    if (table.style.display === 'none') {
        table.style.display = 'table';
        arrow.textContent = '▼';
    } else {
        table.style.display = 'none';
        arrow.textContent = '▶';
    }
};

window.openAddProductModal = async function() {
    document.getElementById('productModalTitle').textContent = 'Adicionar Produto';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    await loadCategoriesForImport();
    openModal('productModal');
};

window.editProduct = async function(productId) {
    const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
    
    if (product) {
        document.getElementById('productModalTitle').textContent = 'Editar Produto';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productUnit').value = product.unit;
        document.getElementById('productCategory').value = product.category_id;
        
        openModal('productModal');
    }
};

window.saveProduct = async function(event) {
    event.preventDefault();
    
    const productId = document.getElementById('productId').value;
    const productData = {
        name: document.getElementById('productName').value,
        price: parseFloat(document.getElementById('productPrice').value),
        description: document.getElementById('productDescription').value,
        unit: document.getElementById('productUnit').value,
        category_id: document.getElementById('productCategory').value
    };
    
    try {
        if (productId) {
            const { error } = await supabase
                .from('products')
                .update(productData)
                .eq('id', productId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('products')
                .insert([productData]);
            if (error) throw error;
        }
        
        alert(productId ? 'Produto atualizado!' : 'Produto adicionado!');
        closeProductModal();
        await loadProducts();
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

window.deleteProduct = function(productId, productName) {
    openDeleteModal(productName, async () => {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);
        
        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            alert('Produto excluído!');
            await loadProducts();
        }
    });
};

window.closeProductModal = function() {
    closeModal('productModal');
};

// =====================================================
// IMPORTAR PRODUTOS (EXCEL)
// =====================================================
document.getElementById('fileInput')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('btnImport').disabled = !document.getElementById('importCategory').value;
    }
});

document.getElementById('importCategory')?.addEventListener('change', function(e) {
    document.getElementById('btnImport').disabled = !e.target.value || !document.getElementById('fileInput').files[0];
});

window.importProducts = async function() {
    const fileInput = document.getElementById('fileInput');
    const categoryId = document.getElementById('importCategory').value;
    
    if (!fileInput.files[0] || !categoryId) {
        alert('Selecione uma categoria e um arquivo!');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            // Usar SheetJS para ler Excel
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            
            // Mapear colunas (flexível para diferentes formatos)
            const products = rows.map(row => ({
                name: row.Produto || row.produto || row.Nome || row.nome,
                price: parseFloat(row.Preço || row.Preco || row.preco || row.Price || 0),
                unit: row.Unidade || row.unidade || row.Unit || 'UN',
                category_id: categoryId
            })).filter(p => p.name && p.price > 0);
            
            if (products.length === 0) {
                alert('Nenhum produto válido encontrado no arquivo!');
                return;
            }
            
            const { error } = await supabase
                .from('products')
                .insert(products);
            
            if (error) throw error;
            
            alert(`${products.length} produtos importados com sucesso!`);
            fileInput.value = '';
            document.getElementById('fileName').textContent = 'Nenhum ficheiro selecionado';
            document.getElementById('importCategory').value = '';
            document.getElementById('btnImport').disabled = true;
            
            await loadProducts();
            
        } catch (error) {
            alert('Erro ao importar: ' + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
};

// =====================================================
// ESTOQUE
// =====================================================
async function loadStockCategories() {
    const { data: categories } = await supabase
        .from('categories')
        .select(`
            *,
            stock(count)
        `)
        .order('name');
    
    displayStockCategories(categories);
}

function displayStockCategories(categories) {
    const grid = document.getElementById('stockCategoriesGrid');
    grid.innerHTML = '';
    
    categories?.forEach(category => {
        const stockCount = category.stock?.[0]?.count || 0;
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-card-header">
                <div>
                    <h4>${category.name}</h4>
                    <p class="category-count">${stockCount} itens em estoque</p>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// =====================================================
// AVISOS
// =====================================================
async function loadAnnouncements() {
    const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erro ao carregar avisos:', error);
        return;
    }
    
    displayAnnouncements(announcements);
}

function displayAnnouncements(announcements) {
    const tbody = document.getElementById('announcementsTable');
    tbody.innerHTML = '';
    
    if (announcements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum aviso cadastrado</td></tr>';
        return;
    }
    
    announcements.forEach(announcement => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${announcement.title}</td>
            <td>${announcement.content.substring(0, 50)}...</td>
            <td>
                <span class="status-badge ${announcement.is_active ? 'status-active' : 'status-inactive'}">
                    ${announcement.is_active ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <button onclick="toggleAnnouncement('${announcement.id}', ${!announcement.is_active})" class="action-btn" title="${announcement.is_active ? 'Desativar' : 'Ativar'}">
                    ${announcement.is_active ? '👁️' : '🔒'}
                </button>
                <button onclick="editAnnouncement('${announcement.id}')" class="action-btn">✏️</button>
                <button onclick="deleteAnnouncement('${announcement.id}', '${announcement.title}')" class="action-btn">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.openAddAnnouncementModal = function() {
    document.getElementById('announcementModalTitle').textContent = 'Novo Aviso';
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementId').value = '';
    document.getElementById('announcementActive').checked = true;
    openModal('announcementModal');
};

window.editAnnouncement = async function(announcementId) {
    const { data: announcement } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', announcementId)
        .single();
    
    if (announcement) {
        document.getElementById('announcementModalTitle').textContent = 'Editar Aviso';
        document.getElementById('announcementId').value = announcement.id;
        document.getElementById('announcementTitle').value = announcement.title;
        document.getElementById('announcementContent').value = announcement.content;
        document.getElementById('announcementActive').checked = announcement.is_active;
        
        openModal('announcementModal');
    }
};

window.saveAnnouncement = async function(event) {
    event.preventDefault();
    
    const announcementId = document.getElementById('announcementId').value;
    const announcementData = {
        title: document.getElementById('announcementTitle').value,
        content: document.getElementById('announcementContent').value,
        is_active: document.getElementById('announcementActive').checked
    };
    
    try {
        if (announcementId) {
            const { error } = await supabase
                .from('announcements')
                .update(announcementData)
                .eq('id', announcementId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('announcements')
                .insert([announcementData]);
            if (error) throw error;
        }
        
        alert(announcementId ? 'Aviso atualizado!' : 'Aviso criado!');
        closeAnnouncementModal();
        await loadAnnouncements();
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

window.toggleAnnouncement = async function(announcementId, newStatus) {
    const { error } = await supabase
        .from('announcements')
        .update({ is_active: newStatus })
        .eq('id', announcementId);
    
    if (error) {
        alert('Erro: ' + error.message);
    } else {
        await loadAnnouncements();
    }
};

window.deleteAnnouncement = function(announcementId, announcementTitle) {
    openDeleteModal(announcementTitle, async () => {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', announcementId);
        
        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            alert('Aviso excluído!');
            await loadAnnouncements();
        }
    });
};

window.closeAnnouncementModal = function() {
    closeModal('announcementModal');
};

// =====================================================
// USUÁRIOS
// =====================================================
async function loadUsers() {
    const { data: roles } = await supabase
        .from('user_roles')
        .select(`
            *,
            user:user_id(email)
        `)
        .order('created_at', { ascending: false });
    
    displayUsers(roles);
}

function displayUsers(roles) {
    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = '';
    
    if (!roles || roles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Nenhum usuário cadastrado</td></tr>';
        return;
    }
    
    roles.forEach(role => {
        const email = role.user?.email || 'Email não disponível';
        const isCurrentUser = role.user_id === currentUser?.id;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${email}${isCurrentUser ? ' <strong>(Você)</strong>' : ''}</td>
            <td><span class="status-badge status-active">${role.role}</span></td>
            <td>
                ${!isCurrentUser ? `<button onclick="deleteUser('${role.user_id}', '${email}')" class="action-btn">🗑️</button>` : '-'}
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.createUser = async function(event) {
    event.preventDefault();
    
    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    
    // Nota: Para criar usuários via código, você precisaria usar a Admin API do Supabase
    // ou uma Edge Function. Por enquanto, mostrar instruções SQL.
    
    alert(`Para criar o usuário ${email}:\n\n1. Vá em Authentication > Users no Supabase\n2. Clique em "Add user"\n3. Use o email: ${email}\n4. Defina a senha\n\n5. Depois execute no SQL Editor:\n\nINSERT INTO user_roles (user_id, role)\nSELECT id, 'user'\nFROM auth.users\nWHERE email = '${email}';`);
    
    document.getElementById('createUserForm').reset();
};

window.deleteUser = function(userId, userEmail) {
    openDeleteModal(userEmail, async () => {
        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId);
        
        if (error) {
            alert('Erro ao remover: ' + error.message);
        } else {
            alert('Permissões removidas!');
            await loadUsers();
        }
    });
};

// =====================================================
// DOWNLOAD DA TABELA DE PREÇOS
// =====================================================
window.downloadPriceTable = async function() {
    const { data: products } = await supabase
        .from('products')
        .select(`
            *,
            category:categories(name)
        `)
        .order('category_id')
        .order('name');
    
    if (!products || products.length === 0) {
        alert('Nenhum produto para exportar!');
        return;
    }
    
    // Criar dados para Excel
    const excelData = products.map(p => ({
        Categoria: p.category?.name || '',
        Produto: p.name,
        Preço: p.price,
        Unidade: p.unit
    }));
    
    // Criar workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tabela de Preços");
    
    // Download
    XLSX.writeFile(wb, `Germina_Tabela_Precos_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// =====================================================
// MODAIS (HELPERS)
// =====================================================
function openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById(modalId).classList.remove('active');
}

window.closeAllModals = function() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
};

function openDeleteModal(itemName, callback) {
    document.getElementById('deleteItemName').textContent = itemName;
    deleteCallback = callback;
    openModal('deleteModal');
}

window.confirmDelete = async function() {
    if (deleteCallback) {
        await deleteCallback();
        deleteCallback = null;
    }
    closeDeleteModal();
};

window.closeDeleteModal = function() {
    closeModal('deleteModal');
    deleteCallback = null;
};
