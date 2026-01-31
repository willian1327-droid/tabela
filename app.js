// =====================================================
// GERMINA - Sistema de Tabela de Preços
// app.js - Versão com CDN global
// =====================================================

// Aguardar o Supabase carregar via CDN
const SUPABASE_URL = 'https://igbvisxkwxfyftfdhotq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnYnZpc3hrd3hmeWZ0ZmRob3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTUwMTEsImV4cCI6MjA4NTM3MTAxMX0.Xkgl_zETPl8vfe4YcQS77LhyKrh7zcbGAF36HC5amgU';

let supabase;
let currentUser = null;
let currentTab = 'importar';
let deleteCallback = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================
window.addEventListener('DOMContentLoaded', async () => {
    // Aguardar o Supabase estar disponível
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase não carregado!');
        alert('Erro ao carregar sistema. Recarregue a página.');
        return;
    }
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase inicializado');
    
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
    const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .single();
    
    console.log('Role check:', roleData, roleError);
    
    if (roleError || !roleData || roleData.role !== 'admin') {
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
        console.error('Login error:', error);
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
    
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
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
// CONFIGURAÇÕES
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
// PRODUTOS - Funções básicas
// =====================================================
async function loadProducts() {
    const { data: products } = await supabase
        .from('products')
        .select(`*, category:categories(name)`)
        .order('name');
    
    const section = document.getElementById('productsSection');
    document.getElementById('productsCount').textContent = `${products?.length || 0} produtos cadastrados`;
    section.innerHTML = products?.length ? '<p>Produtos carregados</p>' : '<p>Nenhum produto</p>';
}

async function loadStockCategories() {
    console.log('Carregando estoque...');
}

async function loadAnnouncements() {
    console.log('Carregando avisos...');
}

async function loadUsers() {
    console.log('Carregando usuários...');
}

// =====================================================
// MODAIS
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

console.log('✅ App.js carregado');
