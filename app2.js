// =====================================================
// GERMINA - Sistema de Tabela de Preços
// app.js - Versão standalone (sem CDN)
// =====================================================

const SUPABASE_URL = 'https://igbvisxkwxfyftfdhotq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnYnZpc3hrd3hmeWZ0ZmRob3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTUwMTEsImV4cCI6MjA4NTM3MTAxMX0.Xkgl_zETPl8vfe4YcQS77LhyKrh7zcbGAF36HC5amgU';

// Cliente Supabase customizado usando fetch
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
            
            // Salvar sessão
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
                // Verificar se expirou
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
        const session = JSON.parse(localStorage.getItem('supabase_session') || '{}');
        const token = session.access_token || SUPABASE_ANON_KEY;
        
        return {
            select(columns = '*') {
                return {
                    async eq(column, value) {
                        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
                            headers: {
                                'apikey': SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const data = await response.json();
                        
                        if (!response.ok) {
                            return { data: null, error: data };
                        }
                        
                        return {
                            data,
                            error: null,
                            async single() {
                                return { data: data[0] || null, error: data[0] ? null : { message: 'Not found' } };
                            }
                        };
                    },
                    
                    async order(column, opts) {
                        const direction = opts?.ascending ? 'asc' : 'desc';
                        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&order=${column}.${direction}`, {
                            headers: {
                                'apikey': SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const data = await response.json();
                        return { data: response.ok ? data : null, error: response.ok ? null : data };
                    },
                    
                    async in(column, values) {
                        const inClause = values.map(v => `"${v}"`).join(',');
                        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${column}=in.(${inClause})`, {
                            headers: {
                                'apikey': SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const data = await response.json();
                        return { data: response.ok ? data : null, error: response.ok ? null : data };
                    }
                };
            },
            
            async insert(values) {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(values)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    return { data: null, error };
                }
                
                return { data: values, error: null };
            },
            
            update(values) {
                return {
                    async eq(column, value) {
                        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
                            method: 'PATCH',
                            headers: {
                                'apikey': SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify(values)
                        });
                        
                        if (!response.ok) {
                            const error = await response.json();
                            return { error };
                        }
                        
                        return { error: null };
                    }
                };
            },
            
            delete() {
                return {
                    async eq(column, value) {
                        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
                            method: 'DELETE',
                            headers: {
                                'apikey': SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            const error = await response.json();
                            return { error };
                        }
                        
                        return { error: null };
                    }
                };
            }
        };
    }
};

let currentUser = null;
let currentTab = 'importar';
let deleteCallback = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================
window.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Sistema Germina iniciado');
    console.log('✅ Cliente Supabase customizado carregado');
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
    console.log('✅ Usuário autenticado:', currentUser.email);
    
    // Verificar se é admin
    const roleResult = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);
    
    console.log('🔍 Resultado da verificação de role:', roleResult);
    
    // roleResult.data é um array, pegar o primeiro item
    const userRole = roleResult.data && roleResult.data[0];
    
    console.log('👤 Role do usuário:', userRole);
    
    if (roleResult.error || !userRole || userRole.role !== 'admin') {
        console.log('❌ Não é admin ou erro');
        alert('Acesso negado! Apenas administradores.');
        await supabase.auth.signOut();
        showLogin();
        return;
    }
    
    console.log('✅ É admin! Mostrando dashboard...');
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
        
        if (error) throw new Error(error.message || error.msg || 'Erro ao fazer login');
        
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
// NAVEGAÇÃO
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

async function loadTabData(tabName) {
    console.log('Carregando aba:', tabName);
    switch(tabName) {
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
    const { data: settings } = await supabase
        .from('settings')
        .select('*');
    
    if (settings && settings.data) {
        const taxName = settings.data.find(s => s.key === 'tax_name')?.value || 'Tributação';
        const taxPercentage = settings.data.find(s => s.key === 'tax_percentage')?.value || '5';
        
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
        .select('*');
    
    if (error) {
        console.error('Erro ao carregar categorias:', error);
        return;
    }
    
    displayCategories(categories.data || []);
}

function displayCategories(categories) {
    const grid = document.getElementById('categoriesGrid');
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
    const { data: categories } = await supabase
        .from('categories')
        .select('*');
    
    const selects = ['importCategory', 'stockCategory', 'productCategory'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Selecione uma categoria...</option>';
            if (categories && categories.data) {
                categories.data.forEach(cat => {
                    select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
                });
            }
        }
    });
}

window.openNewCategoryModal = function() {
    document.getElementById('categoryModalTitle').textContent = 'Nova Categoria';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    
    // Desmarcar todos os checkboxes
    document.querySelectorAll('#categoryForm input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    openModal('categoryModal');
};

window.editCategory = async function(categoryId) {
    const { data: categoryResponse } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId);
    
    const category = categoryResponse?.data?.[0];
    
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
            alert('Categoria atualizada!');
        } else {
            const { error } = await supabase
                .from('categories')
                .insert([categoryData]);
            if (error) throw error;
            alert('Categoria criada!');
        }
        
        closeCategoryModal();
        await loadCategories();
        await loadCategoriesForImport();
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

window.deleteCategory = function(categoryId, categoryName) {
    if (!confirm(`Excluir categoria: ${categoryName}?`)) return;
    
    supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .then(({ error }) => {
            if (error) {
                alert('Erro ao excluir: ' + error.message);
            } else {
                alert('Categoria excluída!');
                loadCategories();
                loadCategoriesForImport();
            }
        });
};

window.closeCategoryModal = function() {
    closeModal('categoryModal');
};

async function loadProducts() {
    const { data: products } = await supabase
        .from('products')
        .select('*, category:categories(name)');
    
    const section = document.getElementById('productsSection');
    const productsData = products.data || [];
    document.getElementById('productsCount').textContent = `${productsData.length} produtos cadastrados`;
    
    if (productsData.length === 0) {
        section.innerHTML = '<p>Nenhum produto cadastrado ainda.</p>';
        return;
    }
    
    // Agrupar por categoria
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

// =====================================================
// GERENCIAR PRODUTOS
// =====================================================
window.openAddProductModal = async function() {
    document.getElementById('productModalTitle').textContent = 'Adicionar Produto';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    
    // Carregar categorias no select
    const { data: categories } = await supabase.from('categories').select('*');
    const select = document.getElementById('productCategory');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    if (categories && categories.data) {
        categories.data.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    openModal('productModal');
};

window.editProduct = async function(productId) {
    // Carregar categorias
    const { data: categories } = await supabase.from('categories').select('*');
    const select = document.getElementById('productCategory');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    if (categories && categories.data) {
        categories.data.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    // Carregar produto
    const { data: productResponse } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId);
    
    const product = productResponse?.data?.[0];
    
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
            alert('Produto atualizado!');
        } else {
            const { error } = await supabase
                .from('products')
                .insert([productData]);
            if (error) throw error;
            alert('Produto adicionado!');
        }
        
        closeProductModal();
        await loadProducts();
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

window.deleteProduct = function(productId, productName) {
    if (!confirm(`Excluir produto: ${productName}?`)) return;
    
    supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .then(({ error }) => {
            if (error) {
                alert('Erro ao excluir: ' + error.message);
            } else {
                alert('Produto excluído!');
                loadProducts();
            }
        });
};

window.closeProductModal = function() {
    closeModal('productModal');
};

// =====================================================
// IMPORTAR PRODUTOS VIA EXCEL
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
        
        console.log('Dados do Excel:', rows);
        
        // Mapear colunas (flexível para diferentes formatos)
        const products = rows.map(row => {
            // Tentar diferentes nomes de colunas
            const name = row.Produto || row.produto || row.Nome || row.nome || row.Product || row.PRODUTO;
            const price = parseFloat(
                row.Preço || row.Preco || row.preco || row.Price || row.price || 
                row['Preço'] || row.PREÇO || row.Valor || row.valor || 0
            );
            const unit = row.Unidade || row.unidade || row.Unit || row.unit || row.UN || 'UN';
            
            return {
                name,
                price,
                unit,
                category_id: categoryId
            };
        }).filter(p => p.name && p.price > 0);
        
        console.log('Produtos processados:', products);
        
        if (products.length === 0) {
            alert('❌ Nenhum produto válido encontrado!\n\nVerifique se o Excel tem as colunas:\n- Produto (nome)\n- Preço (valor)\n- Unidade (opcional)');
            return;
        }
        
        // Inserir produtos
        const { error } = await supabase
            .from('products')
            .insert(products);
        
        if (error) throw error;
        
        alert(`✅ ${products.length} produtos importados com sucesso!`);
        
        // Limpar formulário
        fileInput.value = '';
        document.getElementById('fileName').textContent = 'Nenhum ficheiro selecionado';
        document.getElementById('importCategory').value = '';
        btnImport.disabled = true;
        
        // Recarregar produtos
        await loadProducts();
        
    } catch (error) {
        console.error('Erro ao importar:', error);
        alert('❌ Erro ao importar: ' + error.message);
    } finally {
        btnImport.disabled = false;
        btnImport.textContent = 'Importar Produtos';
    }
};

// =====================================================
// CRIAR USUÁRIO
// =====================================================
window.createUser = async function(event) {
    event.preventDefault();
    
    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    
    if (!confirm(`Criar usuário: ${email}?`)) return;
    
    const btnSubmit = event.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Criando...';
    
    try {
        // Obter token atual
        const session = JSON.parse(localStorage.getItem('supabase_session') || '{}');
        const token = session.access_token;
        
        if (!token) {
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        // Chamar Edge Function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, name })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Erro ao criar usuário');
        }
        
        alert('✅ Usuário criado com sucesso!\n\nO usuário pode fazer login com:\nEmail: ' + email);
        document.getElementById('createUserForm').reset();
        
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao criar usuário: ' + error.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = originalText;
    }
};

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

console.log('✅ App.js standalone carregado com sucesso');
