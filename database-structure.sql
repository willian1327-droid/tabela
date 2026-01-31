-- =====================================================
-- GERMINA - Sistema de Tabela de Preços
-- Estrutura completa do banco de dados
-- =====================================================

-- =====================================================
-- 1. TABELA DE CATEGORIAS
-- =====================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    units TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array de unidades permitidas (TN, KG, LT, UN)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. TABELA DE PRODUTOS
-- =====================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    price NUMERIC(10,2) NOT NULL,
    unit TEXT NOT NULL, -- TN, KG, LT, UN
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. TABELA DE ESTOQUE
-- =====================================================
CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id)
);

-- =====================================================
-- 4. TABELA DE AVISOS
-- =====================================================
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. TABELA DE ROLES (PERMISSÕES)
-- =====================================================
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. TABELA DE CONFIGURAÇÕES (TRIBUTAÇÃO)
-- =====================================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INSERIR CONFIGURAÇÕES PADRÃO
-- =====================================================
INSERT INTO settings (key, value, description) VALUES
('tax_name', 'ICMS', 'Nome do imposto'),
('tax_percentage', '5', 'Porcentagem do imposto');

-- =====================================================
-- INSERIR CATEGORIAS PADRÃO (baseadas nos prints)
-- =====================================================
INSERT INTO categories (name, units) VALUES
('CP MULT', ARRAY['TN', 'UN']),
('CP NUTRI', ARRAY['LT', 'KG']),
('CP TURBO', ARRAY['TN']),
('DIREPLAN', ARRAY['KG']),
('NUTRIÇÃO OVERMAX', ARRAY['UN']),
('SAIS', ARRAY['KG', 'UN']);

-- =====================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS PARA CATEGORIES
-- =====================================================
CREATE POLICY "Qualquer um pode ver categorias"
ON categories FOR SELECT
TO public
USING (true);

CREATE POLICY "Apenas admin pode inserir categorias"
ON categories FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Apenas admin pode atualizar categorias"
ON categories FOR UPDATE
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Apenas admin pode deletar categorias"
ON categories FOR DELETE
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

-- =====================================================
-- POLÍTICAS PARA PRODUCTS
-- =====================================================
CREATE POLICY "Qualquer um pode ver produtos"
ON products FOR SELECT
TO public
USING (true);

CREATE POLICY "Apenas admin pode inserir produtos"
ON products FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Apenas admin pode atualizar produtos"
ON products FOR UPDATE
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Apenas admin pode deletar produtos"
ON products FOR DELETE
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

-- =====================================================
-- POLÍTICAS PARA STOCK
-- =====================================================
CREATE POLICY "Qualquer um pode ver estoque"
ON stock FOR SELECT
TO public
USING (true);

CREATE POLICY "Apenas admin pode gerenciar estoque"
ON stock FOR ALL
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

-- =====================================================
-- POLÍTICAS PARA ANNOUNCEMENTS
-- =====================================================
CREATE POLICY "Qualquer um pode ver avisos ativos"
ON announcements FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admin pode ver todos os avisos"
ON announcements FOR SELECT
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Apenas admin pode gerenciar avisos"
ON announcements FOR ALL
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

-- =====================================================
-- POLÍTICAS PARA USER_ROLES
-- =====================================================
CREATE POLICY "Usuários autenticados podem ver suas próprias roles"
ON user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admin pode gerenciar roles"
ON user_roles FOR ALL
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

-- =====================================================
-- POLÍTICAS PARA SETTINGS
-- =====================================================
CREATE POLICY "Qualquer um pode ver configurações"
ON settings FOR SELECT
TO public
USING (true);

CREATE POLICY "Apenas admin pode alterar configurações"
ON settings FOR ALL
TO authenticated
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

-- =====================================================
-- TRIGGERS PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON stock
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ÍNDICES PARA MELHOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_announcements_active ON announcements(is_active);

-- =====================================================
-- FIM DA ESTRUTURA DO BANCO DE DADOS
-- =====================================================
