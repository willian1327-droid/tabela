// =====================================================
// GERMINA - Sistema de Tabela de Preços
// Versão Final - 100% Funcional
// =====================================================

const SUPABASE_URL = 'https://igbvisxkwxfyftfdhotq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnYnZpc3hrd3hmeWZ0ZmRob3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTUwMTEsImV4cCI6MjA4NTM3MTAxMX0.Xkgl_zETPl8vfe4YcQS77LhyKrh7zcbGAF36HC5amgU';

// Estado global
let currentUser = null;
let currentTab = 'importar';

// Helper para fazer requisições ao Supabase
async function supabaseRequest(endpoint, options = {}) {
    const session = JSON.parse(localStorage.getItem('supabase_session') || '{}');
    const token = session.access_token || SUPABASE_ANON_KEY;
    
    const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        return { data: null, error: data };
    }
    
    return { data, error: null };
}

// Cliente Supabase simplificado
const supabase = {
    auth: {
        async signInWithPassword({ email, password }) {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                return { data: null, error: data };
            }
            
            localStorage.setItem('supabase_session', JSON.stringify(data));
            return { data, error: null };
        },
        
        async getSession() {
            const sessionStr = localStorage.getItem('supabase_session');
            if (!sessionStr) {
                return { data: { session: null }, error: null };
            }
            
            try {
                const session = JSON.parse(sessionStr);
                if (session.expires_at && session.expires_at < Date.now() / 1000) {
                    localStorage.removeItem('supabase_session');
                    return { data: { session: null }, error: null };
                }
                return { data: { session }, error: null };
            } catch {
                return { data: { session: null }, error: null };
            }
        },
        
        async signOut() {
            localStorage.removeItem('supabase_session');
            return { error: null };
        }
    },
    
    from(table) {
        return {
            select(columns = '*') {
                return {
                    async eq(column, value) {
                        const result = await supabaseRequest(`/rest/v1/${table}?select=${columns}&${column}=eq.${value}`);
                        return result;
                    },
                    
                    async order(column, opts = {}) {
                        const direction = opts.ascending ? 'asc' : 'desc';
                        const result = await supabaseRequest(`/rest/v1/${table}?select=${columns}&order=${column}.${direction}`);
                        return result;
                    },
                    
                    then: async (resolve) => {
                        const result = await supabaseRequest(`/rest/v1/${table}?select=${columns}`);
                        resolve(result);
                    }
                };
            },
            
            async insert(values) {
                return await supabaseRequest(`/rest/v1/${table}`, {
                    method: 'POST',
                    body: JSON.stringify(values),
                    headers: { 'Prefer': 'return=minimal' }
                });
            },
            
            update(values) {
                return {
                    async eq(column, value) {
                        return await supabaseRequest(`/rest/v1/${table}?${column}=eq.${value}`, {
                            method: 'PATCH',
                            body: JSON.stringify(values),
                            headers: { 'Prefer': 'return=minimal' }
                        });
                    }
                };
            },
            
            delete() {
                return {
                    async eq(column, value) {
                        return await supabaseRequest(`/rest/v1/${table}?${column}=eq.${value}`, {
                            method: 'DELETE'
                        });
                    }
                };
            }
        };
    }
};

// =====================================================
// INICIALIZAÇÃO
// =====================================================
window.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Sistema Germina iniciado');
    await checkAuth();
});

// =====================================================
// AUTENTICAÇÃO
// =====================================================
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        showLogin();
        return;
    }
    
    currentUser = session.user;
    
    // Verificar se é admin
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', currentUser.id);
    
    const userRole = roles?.[0];
    
    if (!userRole || userRole.role !== 'admin') {
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) throw new Error(error.message || 'Erro ao fazer login');
        
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
// NAVEGAÇÃO
// =====================================================
window.switchTab = function(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    
    loadTabData(tabName);
};

async function loadTabData(tabName) {
    console.log('Carregando aba:', tabName);
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
    }
}

async function loadAllData() {
    await loadTabData(currentTab);
}

// =====================================================
// CONFIGURAÇÕES
// =====================================================
async function loadTaxSettings() {
    const { data: settings } = await supabase.from('settings').select('*');
    
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
    console.log('📂 Carregando categorias...');
    const { data: categories, error } = await supabase.from('categories').select('*');
    
    if (error) {
        console.error('Erro:', error);
        return;
    }
    
    console.log('✅ Categorias carregadas:', categories);
    displayCategories(categories || []);
}

function displayCategories(categories) {
    const grid = document.getElementById('categoriesGrid');
    
    if (!grid) {
        console.error('❌ Element categoriesGrid não encontrado');
        return;
    }
    
    grid.innerHTML = '';
    
    if (categories.length === 0) {
        grid.innerHTML = '<p>Nenhuma categoria cadastrada.</p>';
        return;
    }
    
    categories.forEach(category => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-card-header">
                <div>
                    <h4>${category.name}</h4>
                </div>
                <div class="category-actions">
                    <button onclick="editCategory('${category.id}')" class="action-btn" title="Editar">✏️</button>
                    <button onclick="deleteCategory('${category.id}', '${category.name.replace(/'/g, "\\'")}')" class="action-btn" title="Excluir">🗑️</button>
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
    const { data: categories } = await supabase.from('categories').select('*');
    
    const selects = ['importCategory', 'stockCategory', 'productCategory'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Selecione uma categoria...</option>';
            if (categories) {
                categories.forEach(cat => {
                    select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
                });
            }
        }
    });
}

window.openNewCategoryModal = function() {
    console.log('🔧 Abrindo modal de categoria...');
    
    const modalTitle = document.getElementById('categoryModalTitle');
    const form = document.getElementById('categoryForm');
    const idInput = document.getElementById('categoryId');
    
    if (!modalTitle || !form || !idInput) {
        console.error('❌ Elementos do modal não encontrados');
        alert('Erro: Modal não encontrado. Recarregue a página.');
        return;
    }
    
    modalTitle.textContent = 'Nova Categoria';
    form.reset();
    idInput.value = '';
    
    document.querySelectorAll('#categoryForm input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    openModal('categoryModal');
};

window.editCategory = async function(categoryId) {
    const { data: categories } = await supabase.from('categories').select('*').eq('id', categoryId);
    
    const category = categories?.[0];
    
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
    
    console.log('💾 Salvando categoria:', { categoryId, name, units });
    
    const categoryData = { name, units };
    
    try {
        if (categoryId) {
            const { error } = await supabase.from('categories').update(categoryData).eq('id', categoryId);
            if (error) throw error;
            alert('✅ Categoria atualizada!');
        } else {
            const { error } = await supabase.from('categories').insert([categoryData]);
            if (error) throw error;
            alert('✅ Categoria criada!');
        }
        
        closeCategoryModal();
        
        // Recarregar TUDO
        console.log('🔄 Recarregando categorias...');
        await loadCategories();
        await loadCategoriesForImport();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        alert('Erro: ' + error.message);
    }
};

window.deleteCategory = async function(categoryId, categoryName) {
    if (!confirm(`Excluir categoria: ${categoryName}?`)) return;
    
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    
    if (error) {
        alert('Erro: ' + error.message);
    } else {
        alert('Categoria excluída!');
        await loadCategories();
        await loadCategoriesForImport();
    }
};

window.closeCategoryModal = function() {
    closeModal('categoryModal');
};

// =====================================================
// PRODUTOS
// =====================================================
async function loadProducts() {
    console.log('📦 Carregando produtos...');
    const { data: products } = await supabase.from('products').select('*, category:categories(name)');
    
    const section = document.getElementById('productsSection');
    const productsData = products || [];
    document.getElementById('productsCount').textContent = `${productsData.length} produtos cadastrados`;
    
    if (productsData.length === 0) {
        section.innerHTML = '<p>Nenhum produto cadastrado ainda.</p>';
        return;
    }
    
    const grouped = productsData.reduce((acc, product) => {
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
                                <button onclick="deleteProduct('${product.id}', '${product.name.replace(/'/g, "\\'")}')" class="action-btn">🗑️</button>
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
    
    const { data: categories } = await supabase.from('categories').select('*');
    const select = document.getElementById('productCategory');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    if (categories) {
        categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    openModal('productModal');
};

window.editProduct = async function(productId) {
    const { data: categories } = await supabase.from('categories').select('*');
    const select = document.getElementById('productCategory');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    if (categories) {
        categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    const { data: products } = await supabase.from('products').select('*').eq('id', productId);
    const product = products?.[0];
    
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
            const { error } = await supabase.from('products').update(productData).eq('id', productId);
            if (error) throw error;
            alert('Produto atualizado!');
        } else {
            const { error } = await supabase.from('products').insert([productData]);
            if (error) throw error;
            alert('Produto adicionado!');
        }
        
        closeProductModal();
        await loadProducts();
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

window.deleteProduct = async function(productId, productName) {
    if (!confirm(`Excluir produto: ${productName}?`)) return;
    
    const { error } = await supabase.from('products').delete().eq('id', productId);
    
    if (error) {
        alert('Erro: ' + error.message);
    } else {
        alert('Produto excluído!');
        await loadProducts();
    }
};

window.closeProductModal = function() {
    closeModal('productModal');
};

// =====================================================
// IMPORTAR EXCEL
// =====================================================
document.getElementById('fileInput')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = file.name;
        const categorySelected = document.getElementById('importCategory').value;
        document.getElementById('btnImport').disabled = !categorySelected;
    }
});

document.getElementById('importCategory')?.addEventListener('change', function(e) {
    const fileSelected = document.getElementById('fileInput').files[0];
    document.getElementById('btnImport').disabled = !e.target.value || !fileSelected;
});

window.importProducts = async function() {
    const fileInput = document.getElementById('fileInput');
    const categoryId = document.getElementById('importCategory').value;
    
    if (!fileInput.files[0] || !categoryId) {
        alert('Selecione uma categoria e um arquivo!');
        return;
    }
    
    const file = fileInput.files[0];
    const btnImport = document.getElementById('btnImport');
    
    btnImport.disabled = true;
    btnImport.textContent = 'Importando...';
    
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet);
        
        const products = rows.map(row => {
            const name = row.Produto || row.produto || row.Nome || row.nome || row.Product || row.PRODUTO;
            const price = parseFloat(
                row.Preço || row.Preco || row.preco || row.Price || row.price || 
                row['Preço'] || row.PREÇO || row.Valor || row.valor || 0
            );
            const unit = row.Unidade || row.unidade || row.Unit || row.unit || row.UN || 'UN';
            
            return { name, price, unit, category_id: categoryId };
        }).filter(p => p.name && p.price > 0);
        
        if (products.length === 0) {
            alert('❌ Nenhum produto válido encontrado!');
            return;
        }
        
        const { error } = await supabase.from('products').insert(products);
        
        if (error) throw error;
        
        alert(`✅ ${products.length} produtos importados!`);
        
        fileInput.value = '';
        document.getElementById('fileName').textContent = 'Nenhum ficheiro selecionado';
        document.getElementById('importCategory').value = '';
        btnImport.disabled = true;
        
        await loadProducts();
        
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    } finally {
        btnImport.disabled = false;
        btnImport.textContent = 'Importar Produtos';
    }
};

// =====================================================
// MODAIS
// =====================================================
function openModal(modalId) {
    console.log('🔓 Abrindo modal:', modalId);
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

console.log('✅ App.js carregado com sucesso');
