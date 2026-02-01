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
            async select(columns = '*') {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, {
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
                    eq: (column, value) => ({
                        async single() {
                            const filtered = data.find(item => item[column] === value);
                            return { data: filtered || null, error: filtered ? null : { message: 'Not found' } };
                        }
                    }),
                    order: (column, opts) => ({ data, error: null }),
                    in: (column, values) => ({ data, error: null })
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
    
    // Verificar se é admin
    const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);
    
    const role = await roleData.single();
    
    console.log('Role check:', role, roleError);
    
    if (roleError || !role.data || role.data.role !== 'admin') {
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
            </div>
            <div class="category-units">
                ${(category.units || []).map(unit => `<span class="unit-badge">${unit}</span>`).join('')}
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadProducts() {
    const { data: products } = await supabase
        .from('products')
        .select('*');
    
    const section = document.getElementById('productsSection');
    document.getElementById('productsCount').textContent = `${products.data?.length || 0} produtos cadastrados`;
    section.innerHTML = products.data?.length ? '<p>Produtos carregados</p>' : '<p>Nenhum produto</p>';
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

console.log('✅ App.js standalone carregado com sucesso');
